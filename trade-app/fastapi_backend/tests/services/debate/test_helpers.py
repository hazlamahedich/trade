import asyncio
from contextlib import contextmanager, ExitStack
from typing import Any, Callable, Awaitable
from unittest.mock import MagicMock, AsyncMock, patch


def _default_bull_return():
    return {
        "messages": [{"role": "bull", "content": "Test"}],
        "current_turn": 1,
        "current_agent": "bear",
    }


def _default_bear_return():
    return {
        "messages": [
            {"role": "bull", "content": "Test"},
            {"role": "bear", "content": "Bear"},
        ],
        "current_turn": 2,
        "current_agent": "bull",
    }


@contextmanager
def patched_debate_engine(
    analyze_fn: Callable[[Any], Awaitable[dict]],
    *,
    ack_timeout: float = 5,
    freshness_interval: float | None = None,
):
    with ExitStack() as stack:
        mock_bull_cls = stack.enter_context(
            patch("app.services.debate.engine.BullAgent")
        )
        mock_bear_cls = stack.enter_context(
            patch("app.services.debate.engine.BearAgent")
        )
        mock_guard_cls = stack.enter_context(
            patch("app.services.debate.engine.GuardianAgent")
        )
        mock_ss = stack.enter_context(patch("app.services.debate.engine.stream_state"))
        stack.enter_context(
            patch("app.services.debate.engine.GUARDIAN_ACK_TIMEOUT", ack_timeout)
        )

        if freshness_interval is not None:
            stack.enter_context(
                patch(
                    "app.services.debate.engine.FRESHNESS_CHECK_INTERVAL",
                    freshness_interval,
                )
            )

        mock_ss.save_state = AsyncMock()

        mock_bull = MagicMock()
        mock_bull.generate = AsyncMock(return_value=_default_bull_return())
        mock_bull_cls.return_value = mock_bull

        mock_bear = MagicMock()
        mock_bear.generate = AsyncMock(return_value=_default_bear_return())
        mock_bear_cls.return_value = mock_bear

        mock_guard = MagicMock()
        mock_guard.analyze = analyze_fn
        mock_guard_cls.return_value = mock_guard

        yield {
            "bull": mock_bull,
            "bear": mock_bear,
            "guard": mock_guard,
            "stream_state": mock_ss,
        }


def get_action_types(mock_manager: MagicMock) -> list[str]:
    return [c[0][1]["type"] for c in mock_manager.broadcast_to_debate.call_args_list]


async def schedule_ack(debate_id: str, delay: float = 0.1) -> asyncio.Task:
    from app.services.debate.engine import get_pause_event

    async def _set():
        await asyncio.sleep(delay)
        event = get_pause_event(debate_id)
        assert event is not None
        event.set()

    return asyncio.create_task(_set())
