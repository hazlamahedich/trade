import asyncio
import pytest
from unittest.mock import patch

from app.services.debate.engine import (
    get_pause_event,
    _wait_for_guardian_ack,
    _pause_events,
)


class TestWaitForGuardianAck:
    def setup_method(self):
        _pause_events.clear()

    def teardown_method(self):
        _pause_events.clear()

    @pytest.mark.asyncio
    async def test_2_2_unit_006_resolves_on_event_set(self):
        """[2-2-UNIT-006] @p1 _wait_for_guardian_ack resolves when event is set.

        Given a coroutine waiting on _wait_for_guardian_ack
        When the pause event is set after a short delay
        Then the result is "acknowledged" and the event is cleaned up
        """

        async def set_event_after_delay():
            await asyncio.sleep(0.05)
            event = get_pause_event("deb_ack")
            assert event is not None
            event.set()

        task = asyncio.create_task(set_event_after_delay())
        result = await _wait_for_guardian_ack("deb_ack", "high")
        await task

        assert result == "acknowledged"
        assert get_pause_event("deb_ack") is None

    @pytest.mark.asyncio
    async def test_2_2_unit_007_times_out_gracefully(self):
        """[2-2-UNIT-007] @p1 _wait_for_guardian_ack returns "timeout" on expiry.

        Given a coroutine waiting on _wait_for_guardian_ack with a short timeout
        When the event is never set
        Then the result is "timeout" and the event is cleaned up
        """
        with patch("app.services.debate.engine.GUARDIAN_ACK_TIMEOUT", 0.1):
            result = await _wait_for_guardian_ack("deb_timeout", "high")

        assert result == "timeout"
        assert get_pause_event("deb_timeout") is None

    @pytest.mark.asyncio
    async def test_2_2_unit_008_creates_fresh_event_per_call(self):
        """[2-2-UNIT-008] @p1 Each _wait_for_guardian_ack call creates a fresh event.

        Given a first call that times out
        When a second call is made and the event is set
        Then the second call resolves as "acknowledged"
        """
        with patch("app.services.debate.engine.GUARDIAN_ACK_TIMEOUT", 0.1):
            result1 = await _wait_for_guardian_ack("deb_fresh", "high")

        assert result1 == "timeout"

        async def set_second_event():
            await asyncio.sleep(0.05)
            event = get_pause_event("deb_fresh")
            assert event is not None
            event.set()

        task = asyncio.create_task(set_second_event())
        result2 = await _wait_for_guardian_ack("deb_fresh", "medium")
        await task

        assert result2 == "acknowledged"

    @pytest.mark.asyncio
    async def test_2_2_unit_009_clears_event_after_ack(self):
        """[2-2-UNIT-009] @p1 Event is cleaned up after successful acknowledgment.

        Given a coroutine waiting on _wait_for_guardian_ack
        When the event is set and the coroutine resolves
        Then get_pause_event returns None
        """

        async def set_event():
            await asyncio.sleep(0.05)
            event = get_pause_event("deb_clear")
            event.set()

        task = asyncio.create_task(set_event())
        await _wait_for_guardian_ack("deb_clear", "high")
        await task

        assert get_pause_event("deb_clear") is None
