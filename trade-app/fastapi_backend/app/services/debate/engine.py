import asyncio
import logging
from datetime import datetime
from typing import Any

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from app.services.debate.state import DebateState
from app.services.debate.agents.bull import BullAgent
from app.services.debate.agents.bear import BearAgent
from app.services.debate.streaming import (
    DebateConnectionManager,
    TokenStreamingHandler,
    send_argument_complete,
    send_status_update,
    send_turn_change,
    send_data_stale,
    stream_state,
)
from app.services.market.stale_data_guardian import StaleDataGuardian

logger = logging.getLogger(__name__)


class StaleDataError(Exception):
    def __init__(
        self,
        code: str = "DATA_STALE",
        message: str = "Market data is stale",
        last_update: datetime | None = None,
    ):
        self.code = code
        self.message = message
        self.last_update = last_update
        super().__init__(message)


FRESHNESS_CHECK_INTERVAL = 5


def should_continue(state: DebateState) -> bool:
    """Check if debate should continue."""
    return state["current_turn"] < state["max_turns"]


async def bull_agent_node(
    state: DebateState,
    manager: DebateConnectionManager | None = None,
    debate_id: str | None = None,
) -> dict[str, Any]:
    handler = None
    if manager and debate_id:
        handler = TokenStreamingHandler(manager, debate_id, "bull")

    agent = BullAgent(streaming_handler=handler)
    result = await agent.generate(state)
    logger.info(f"Bull agent generated argument, turn {state['current_turn']}")

    if manager and debate_id:
        await send_argument_complete(
            manager,
            debate_id,
            "bull",
            result["messages"][-1]["content"],
            result["current_turn"],
        )
        await send_turn_change(manager, debate_id, "bear")

    return result


async def bear_agent_node(
    state: DebateState,
    manager: DebateConnectionManager | None = None,
    debate_id: str | None = None,
) -> dict[str, Any]:
    handler = None
    if manager and debate_id:
        handler = TokenStreamingHandler(manager, debate_id, "bear")

    agent = BearAgent(streaming_handler=handler)
    result = await agent.generate(state)
    logger.info(f"Bear agent generated argument, turn {state['current_turn']}")

    if manager and debate_id:
        await send_argument_complete(
            manager,
            debate_id,
            "bear",
            result["messages"][-1]["content"],
            result["current_turn"],
        )
        await send_turn_change(manager, debate_id, "bull")

    return result


def create_debate_graph():
    """Create the debate workflow graph.

    NOTE: Uses MemorySaver checkpointer for single-worker deployments.
    For multi-worker production, replace with RedisSaver or ensure
    stream_state (Redis) covers all reconnection scenarios.
    """
    workflow = StateGraph(DebateState)

    workflow.add_node("bull", bull_agent_node)
    workflow.add_node("bear", bear_agent_node)

    workflow.add_conditional_edges("bull", should_continue, {True: "bear", False: END})
    workflow.add_conditional_edges("bear", should_continue, {True: "bull", False: END})

    workflow.set_entry_point("bull")
    return workflow.compile(checkpointer=MemorySaver())


async def stream_debate(
    debate_id: str,
    asset: str,
    market_context: dict,
    manager: DebateConnectionManager,
    max_turns: int = 6,
    stale_guardian: StaleDataGuardian | None = None,
) -> dict[str, Any]:
    """Stream debate tokens via async generator with WebSocket broadcasting."""
    if stale_guardian is None:
        from app.config import settings

        stale_guardian = StaleDataGuardian(
            cache_redis_url=settings.REDIS_URL,
        )

    freshness = await stale_guardian.get_freshness_status(asset)
    if freshness.is_stale:
        raise StaleDataError(
            code="DATA_STALE",
            message=f"Market data is {freshness.age_seconds}s old. Cannot start debate.",
            last_update=freshness.last_update,
        )

    initial_state: DebateState = {
        "asset": asset,
        "market_context": market_context,
        "messages": [],
        "current_turn": 0,
        "max_turns": max_turns,
        "current_agent": "bull",
        "status": "running",
    }

    await stream_state.save_state(debate_id, {"status": "running", "asset": asset})
    await send_status_update(manager, debate_id, "running")

    stale_event = asyncio.Event()
    freshness_monitor_task = asyncio.create_task(
        _monitor_freshness(debate_id, asset, manager, stale_guardian, stale_event)
    )

    current_state = initial_state
    try:
        while should_continue(current_state) and not stale_event.is_set():
            current_agent = current_state["current_agent"]

            if current_agent == "bull":
                result = await bull_agent_node(current_state, manager, debate_id)
            else:
                result = await bear_agent_node(current_state, manager, debate_id)

            current_state = {
                "asset": current_state["asset"],
                "market_context": current_state["market_context"],
                "messages": result["messages"],
                "current_turn": result["current_turn"],
                "max_turns": current_state["max_turns"],
                "current_agent": result["current_agent"],
                "status": "running",
            }

            await stream_state.save_state(
                debate_id,
                {
                    "status": "running",
                    "asset": asset,
                    "current_turn": current_state["current_turn"],
                    "current_agent": current_state["current_agent"],
                },
            )

        if stale_event.is_set():
            await stream_state.save_state(
                debate_id,
                {"status": "paused", "asset": asset, "reason": "DATA_STALE"},
            )
            await send_status_update(manager, debate_id, "paused")
            raise StaleDataError(
                code="DATA_STALE",
                message="Debate paused: market data became stale during debate.",
                last_update=None,
            )

        final_state: dict[str, Any] = {
            **current_state,
            "status": "completed",
        }
        await stream_state.save_state(
            debate_id,
            {
                "status": "completed",
                "asset": asset,
                "current_turn": current_state["current_turn"],
            },
        )
        await send_status_update(manager, debate_id, "completed")

        return final_state

    except StaleDataError:
        raise
    except Exception as e:
        logger.error(f"Error streaming debate {debate_id}: {e}")
        await stream_state.save_state(
            debate_id, {"status": "error", "asset": asset, "error": str(e)}
        )
        await send_status_update(manager, debate_id, "error")
        raise
    finally:
        freshness_monitor_task.cancel()
        try:
            await freshness_monitor_task
        except asyncio.CancelledError:
            pass


async def _monitor_freshness(
    debate_id: str,
    asset: str,
    manager: DebateConnectionManager,
    guardian: StaleDataGuardian,
    stale_event: asyncio.Event | None = None,
) -> None:
    try:
        while True:
            freshness = await guardian.get_freshness_status(asset)
            if freshness.is_stale:
                logger.warning(
                    f"Data stale detected for {asset} in debate {debate_id}: "
                    f"{freshness.age_seconds}s old"
                )
                await send_data_stale(manager, debate_id, freshness)
                if stale_event is not None:
                    stale_event.set()
                break
            await asyncio.sleep(FRESHNESS_CHECK_INTERVAL)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.error(f"Freshness monitor error for debate {debate_id}: {e}")
