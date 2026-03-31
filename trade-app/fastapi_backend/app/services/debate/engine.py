import asyncio
import logging
from datetime import datetime
from typing import Any

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.base import BaseCheckpointSaver
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
    send_reasoning_node,
    send_guardian_interrupt,
    send_guardian_verdict,
    stream_state,
)
from app.services.debate.agents.guardian import GuardianAgent
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


def get_checkpointer() -> BaseCheckpointSaver:
    from app.config import settings

    checkpointer_type = settings.CHECKPOINTER_TYPE
    if checkpointer_type == "postgres":
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        from psycopg_pool import AsyncConnectionPool

        if not settings.CHECKPOINTER_URL:
            raise ValueError(
                "CHECKPOINTER_URL is required when CHECKPOINTER_TYPE is 'postgres'"
            )
        pool = AsyncConnectionPool(conninfo=settings.CHECKPOINTER_URL)
        return AsyncPostgresSaver(pool)
    return MemorySaver()


def create_debate_graph(
    checkpointer: BaseCheckpointSaver | None = None,
) -> Any:
    """Create the debate workflow graph.

    For production deployments with multiple workers, use PostgresSaver
    by setting CHECKPOINTER_TYPE=postgres and CHECKPOINTER_URL in the
    environment. This ensures debate state persists across process
    restarts and is accessible from any worker.
    """
    if checkpointer is None:
        checkpointer = get_checkpointer()

    workflow = StateGraph(DebateState)

    workflow.add_node("bull", bull_agent_node)
    workflow.add_node("bear", bear_agent_node)

    workflow.add_conditional_edges("bull", should_continue, {True: "bear", False: END})
    workflow.add_conditional_edges("bear", should_continue, {True: "bull", False: END})

    workflow.set_entry_point("bull")
    return workflow.compile(checkpointer=checkpointer)


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

    await send_reasoning_node(
        manager,
        debate_id,
        node_id=f"data-{asset}-{debate_id[:8]}",
        node_type="data_input",
        label=f"{asset.upper()} Market Data",
        summary=market_context.get("summary", "Market data loaded"),
    )

    stale_event = asyncio.Event()
    freshness_monitor_task = asyncio.create_task(
        _monitor_freshness(debate_id, asset, manager, stale_guardian, stale_event)
    )

    current_state = initial_state
    turn_arguments: dict[tuple[str, int], str] = {}

    from app.config import settings as app_settings

    guardian = GuardianAgent() if app_settings.guardian_enabled else None

    try:
        while should_continue(current_state) and not stale_event.is_set():
            current_agent = current_state["current_agent"]

            if current_agent == "bull":
                result = await bull_agent_node(current_state, manager, debate_id)  # type: ignore[arg-type]
            else:
                result = await bear_agent_node(current_state, manager, debate_id)  # type: ignore[arg-type]

            current_state = {
                "asset": current_state["asset"],
                "market_context": current_state["market_context"],
                "messages": result["messages"],
                "current_turn": result["current_turn"],
                "max_turns": current_state["max_turns"],
                "current_agent": result["current_agent"],
                "status": "running",
            }

            node_type = "bull_analysis" if current_agent == "bull" else "bear_counter"
            previous_node_id = (
                f"data-{asset}-{debate_id[:8]}"
                if result["current_turn"] == 1
                else f"{current_agent}-turn-{result['current_turn'] - 1}"
            )

            argument_content = result["messages"][-1]["content"]
            turn_arguments[(current_agent, result["current_turn"])] = argument_content

            if guardian is not None:
                try:
                    analysis = await guardian.analyze(current_state)

                    if analysis["should_interrupt"]:
                        await send_guardian_interrupt(
                            manager,
                            debate_id,
                            risk_level=analysis["risk_level"],
                            reason=analysis["reason"],
                            fallacy_type=analysis.get("fallacy_type"),
                            original_agent=current_agent,
                            summary_verdict=analysis["summary_verdict"],
                            turn=result["current_turn"],
                        )
                        await send_reasoning_node(
                            manager,
                            debate_id,
                            node_id=f"guardian-{current_agent}-turn-{result['current_turn']}",
                            node_type="risk_check",
                            label=f"Guardian: {analysis['risk_level'].upper()} Risk",
                            summary=analysis["reason"][:100],
                            parent_id=f"{current_agent}-turn-{result['current_turn']}",
                            turn=result["current_turn"],
                        )
                        current_state.setdefault("guardian_interrupts", []).append(
                            {
                                "turn": result["current_turn"],
                                "agent": current_agent,
                                "risk_level": analysis["risk_level"],
                                "reason": analysis["reason"],
                                "fallacy_type": analysis.get("fallacy_type"),
                            }
                        )
                    else:
                        await send_reasoning_node(
                            manager,
                            debate_id,
                            node_id=f"guardian-{current_agent}-turn-{result['current_turn']}",
                            node_type="risk_check",
                            label="Guardian: Safe",
                            summary="No issues detected",
                            parent_id=f"{current_agent}-turn-{result['current_turn']}",
                            turn=result["current_turn"],
                        )
                except Exception as e:
                    logger.error(
                        f"Guardian analysis failed for debate {debate_id}: {e}"
                    )
                    await send_reasoning_node(
                        manager,
                        debate_id,
                        node_id=f"guardian-{current_agent}-turn-{result['current_turn']}",
                        node_type="risk_check",
                        label="Guardian: Safe",
                        summary="Guardian analysis skipped",
                        parent_id=f"{current_agent}-turn-{result['current_turn']}",
                        turn=result["current_turn"],
                    )

            await send_reasoning_node(
                manager,
                debate_id,
                node_id=f"{current_agent}-turn-{result['current_turn']}",
                node_type=node_type,
                label=f"{current_agent.title()} Argument #{result['current_turn']}",
                summary=argument_content[:100],
                agent=current_agent,
                parent_id=previous_node_id,
                turn=result["current_turn"],
            )

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

        if guardian is not None:
            try:
                final_analysis = await guardian.analyze(current_state)  # type: ignore[arg-type]
                await send_guardian_verdict(
                    manager,
                    debate_id,
                    verdict=final_analysis.get("summary_verdict", "Caution"),
                    risk_level=final_analysis.get("risk_level", "medium"),
                    summary=final_analysis.get("reason", "Analysis complete"),
                    reasoning=final_analysis.get("detailed_reasoning", ""),
                    total_interrupts=len(current_state.get("guardian_interrupts", [])),
                )
                current_state["guardian_verdict"] = final_analysis.get(
                    "summary_verdict", "Caution"
                )
            except Exception as e:
                logger.error(
                    f"Guardian final verdict failed for debate {debate_id}: {e}"
                )
                await send_guardian_verdict(
                    manager,
                    debate_id,
                    verdict="Caution",
                    risk_level="medium",
                    summary="Guardian analysis unavailable",
                    reasoning="Final verdict could not be generated",
                    total_interrupts=len(current_state.get("guardian_interrupts", [])),
                )

        # TODO: Epic 3 will replace this placeholder with real voting-based winner determination
        final_turn = current_state["current_turn"]
        for turn in range(1, final_turn + 1):
            for agent in ["bull", "bear"]:
                node_id = f"{agent}-turn-{turn}"
                await send_reasoning_node(
                    manager,
                    debate_id,
                    node_id=node_id,
                    node_type="bull_analysis" if agent == "bull" else "bear_counter",
                    label=f"{agent.title()} Argument #{turn}",
                    summary=turn_arguments.get((agent, turn), "")[:100],
                    agent=agent,
                    is_winning=True,
                    turn=turn,
                )

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
