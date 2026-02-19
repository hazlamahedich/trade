import logging
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
    stream_state,
)

logger = logging.getLogger(__name__)


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
) -> dict[str, Any]:
    """Stream debate tokens via async generator with WebSocket broadcasting."""
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

    current_state = initial_state
    try:
        while should_continue(current_state):
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

    except Exception as e:
        logger.error(f"Error streaming debate {debate_id}: {e}")
        await stream_state.save_state(
            debate_id, {"status": "error", "asset": asset, "error": str(e)}
        )
        await send_status_update(manager, debate_id, "error")
        raise
