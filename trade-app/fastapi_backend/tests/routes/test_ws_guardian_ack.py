import asyncio

import pytest

from app.services.debate.engine import (
    _set_pause_event,
    _clear_pause_event,
    get_pause_event,
    _pause_events,
    _wait_for_guardian_ack,
)


class TestWSGuardianInterruptAck:
    """Tests for the DEBATE/GUARDIAN_INTERRUPT_ACK handler in the WS route.

    The handler at app/routes/ws.py lines 126-129 does:
        if action_type == "DEBATE/GUARDIAN_INTERRUPT_ACK":
            pause_event = get_pause_event(debate_id)
            if pause_event:
                pause_event.set()
            continue
    """

    def setup_method(self):
        _pause_events.clear()

    def teardown_method(self):
        _pause_events.clear()

    @pytest.mark.asyncio
    async def test_2_2_api_001_guardian_ack_sets_pause_event(self):
        """[2-2-API-001] @p0 WS receives GUARDIAN_INTERRUPT_ACK → pause_event.set() is called

        Given a debate with a registered pause_event (unset)
        When the WS handler processes a DEBATE/GUARDIAN_INTERRUPT_ACK message
        Then the pause_event is set
        """
        # Given: a debate with a registered, unset pause event
        debate_id = "deb_ack_001"
        pause_event = asyncio.Event()
        _set_pause_event(debate_id, pause_event)

        assert not pause_event.is_set(), "Precondition: event should not be set"

        # When: the WS handler logic for GUARDIAN_INTERRUPT_ACK runs
        # (We simulate the handler logic directly since the full WS loop
        # requires extensive mocking — we test the core behavior)
        fetched_event = get_pause_event(debate_id)
        assert fetched_event is not None, "Pause event should exist for debate"
        fetched_event.set()

        # Then: the original pause_event is now set
        assert pause_event.is_set(), "pause_event should be set after ACK"
        assert fetched_event is pause_event, "Should be the same event object"

        # Cleanup
        _clear_pause_event(debate_id)

    @pytest.mark.asyncio
    async def test_2_2_api_002_guardian_ack_no_pause_event_no_error(self):
        """[2-2-API-002] @p1 WS receives GUARDIAN_INTERRUPT_ACK with no pause event → no error

        Given a debate_id with no registered pause_event
        When the WS handler processes a DEBATE/GUARDIAN_INTERRUPT_ACK message
        Then get_pause_event returns None and no exception is raised
        """
        # Given: a debate with no registered pause event
        debate_id = "deb_ack_002_missing"
        assert get_pause_event(debate_id) is None, (
            "Precondition: no pause event for this debate"
        )

        # When: the WS handler logic for GUARDIAN_INTERRUPT_ACK runs
        # Simulating: pause_event = get_pause_event(debate_id)
        #             if pause_event: pause_event.set()
        error_raised = False
        try:
            pause_event = get_pause_event(debate_id)
            if pause_event:
                pause_event.set()
        except Exception:
            error_raised = True

        # Then: no error is raised and get_pause_event returned None
        assert not error_raised, "Should not raise an error for missing pause event"
        assert pause_event is None, "Should return None for unregistered debate"

    @pytest.mark.asyncio
    async def test_2_2_api_003_guardian_ack_sets_event_in_wait_loop(self):
        """[2-2-API-003] @p0 ACK unblocks a coroutine waiting on _wait_for_guardian_ack.

        Given a coroutine waiting on _wait_for_guardian_ack
        When the GUARDIAN_INTERRUPT_ACK handler sets the event
        Then the waiting coroutine proceeds without timeout
        """
        from app.services.debate.engine import _wait_for_guardian_ack

        debate_id = "deb_ack_003_wait"

        # Given: a coroutine will wait for the ACK
        ack_waiter = asyncio.create_task(_wait_for_guardian_ack(debate_id, "high"))

        # Allow the waiter to start and register its event
        await asyncio.sleep(0.05)

        # When: simulate the WS handler receiving GUARDIAN_INTERRUPT_ACK
        pause_event = get_pause_event(debate_id)
        assert pause_event is not None, "Event should be registered by waiter"
        assert not pause_event.is_set(), "Event should not be set yet"
        pause_event.set()

        # Then: the waiter resolves as "acknowledged"
        result = await asyncio.wait_for(ack_waiter, timeout=1.0)
        assert result == "acknowledged"
        assert get_pause_event(debate_id) is None, "Event should be cleaned up"

    @pytest.mark.asyncio
    async def test_2_2_api_004_disconnect_unblocks_pause_event(self):
        """[2-2-API-004] @p1 WS disconnect during pause unblocks _wait_for_guardian_ack.

        Given a coroutine waiting on _wait_for_guardian_ack
        When the WS disconnect handler sets the event (simulating client disconnect)
        Then the waiting coroutine resolves as "acknowledged"
        """
        debate_id = "deb_disconnect_001"

        ack_waiter = asyncio.create_task(_wait_for_guardian_ack(debate_id, "high"))
        await asyncio.sleep(0.05)

        pause_event = get_pause_event(debate_id)
        assert pause_event is not None
        assert not pause_event.is_set()

        pause_event.set()

        result = await asyncio.wait_for(ack_waiter, timeout=1.0)
        assert result == "acknowledged"
        assert get_pause_event(debate_id) is None
