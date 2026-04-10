# Deferred Work

## Deferred from: code review of 2-3-guardian-ui-overlay-the-freeze (2026-04-10)

- handleDebatePaused is a typed no-op still wired to socket [DebateStream.tsx:260] — pre-existing from Story 2.2 cleanup, not caused by this change
- useReducedMotion() returns null during SSR — hydration mismatch risk for prefers-reduced-motion users [DebateStream.tsx:71,273] — framer-motion SSR behavior, not specific to this story
- Unsafe type cast in error display `(state as { status: "error" })` [GuardianOverlay.tsx:488] — guarded by runtime isError check, low risk
