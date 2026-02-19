class StaleDataError(Exception):
    """Raised when market data is stale and cannot start debate."""

    pass


# NOTE: DebateAlreadyRunningError is defined for future use when
# concurrent debate tracking is implemented (Story 1-4/1-6).
# Currently debates are stateless - each request creates a new debate.
class DebateAlreadyRunningError(Exception):
    """Raised when a debate is already active for the asset."""

    pass


class LLMProviderError(Exception):
    """Raised when LLM provider fails (NFR-07 failover exhausted)."""

    pass
