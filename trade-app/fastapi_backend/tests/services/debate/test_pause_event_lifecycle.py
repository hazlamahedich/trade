import asyncio

from app.services.debate.engine import (
    _set_pause_event,
    _clear_pause_event,
    get_pause_event,
    _pause_events,
)


class TestPauseEventLifecycle:
    def setup_method(self):
        _pause_events.clear()

    def teardown_method(self):
        _pause_events.clear()

    def test_2_2_unit_001_set_pause_event(self):
        """[2-2-UNIT-001] @p2 Pause event can be set and retrieved.

        Given a fresh event store
        When _set_pause_event is called with a debate_id and event
        Then get_pause_event returns the same event object
        """
        event = asyncio.Event()
        _set_pause_event("deb_1", event)

        assert get_pause_event("deb_1") is event

    def test_2_2_unit_002_clear_pause_event(self):
        """[2-2-UNIT-002] @p2 Pause event can be cleared.

        Given a debate with a registered pause_event
        When _clear_pause_event is called
        Then get_pause_event returns None
        """
        event = asyncio.Event()
        _set_pause_event("deb_1", event)
        _clear_pause_event("deb_1")

        assert get_pause_event("deb_1") is None

    def test_2_2_unit_003_clear_nonexistent_event_no_error(self):
        """[2-2-UNIT-003] @p2 Clearing a nonexistent event does not raise.

        Given no registered pause_event for a debate_id
        When _clear_pause_event is called
        Then no exception is raised
        """
        _clear_pause_event("nonexistent")

    def test_2_2_unit_004_get_nonexistent_event(self):
        """[2-2-UNIT-004] @p2 Getting a nonexistent event returns None.

        Given no registered pause_event for a debate_id
        When get_pause_event is called
        Then None is returned
        """
        assert get_pause_event("nonexistent") is None

    def test_2_2_unit_005_clear_event_is_idempotent(self):
        """[2-2-UNIT-005] @p2 Clearing the same event twice is safe.

        Given a debate with a registered pause_event
        When _clear_pause_event is called twice
        Then get_pause_event returns None and no error is raised
        """
        event = asyncio.Event()
        _set_pause_event("deb_1", event)
        _clear_pause_event("deb_1")
        _clear_pause_event("deb_1")

        assert get_pause_event("deb_1") is None
