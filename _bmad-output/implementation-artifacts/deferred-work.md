# Deferred Work

## Deferred from: code review of 2-3-guardian-ui-overlay-the-freeze (2026-04-10)

- handleDebatePaused is a typed no-op still wired to socket [DebateStream.tsx:260] — pre-existing from Story 2.2 cleanup, not caused by this change
- useReducedMotion() returns null during SSR — hydration mismatch risk for prefers-reduced-motion users [DebateStream.tsx:71,273] — framer-motion SSR behavior, not specific to this story
- Unsafe type cast in error display `(state as { status: "error" })` [GuardianOverlay.tsx:488] — guarded by runtime isError check, low risk

## Deferred from: code review of 2-4-forbidden-phrase-filter-regex (2026-04-11)

- Duplicate `DataRefreshedPayload` import in `streaming.py` [streaming.py:10-11] — pre-existing, not introduced by this change
- `_COMPILED_PATTERNS` compiled once at module load, runtime config changes ignored [sanitization.py:45-47] — architectural limitation, same pattern as before
- Guardian agent receives unsanitized content in its LLM prompt via `current_state["messages"]` [engine.py:351] — pre-existing design decision, out of scope
- `result["messages"][-1]` has no bounds check [engine.py:94] — pre-existing, not introduced by this change
- Double iteration over patterns in `sanitize_content` [sanitization.py:80-87] — performance micro-optimization, not a bug
- `zip` truncation on length mismatch between `FORBIDDEN_PHRASES` and `_COMPILED_PATTERNS` [sanitization.py:80] — theoretical risk, always generated from same list
- Test `test_empty_phrase_list` validates unreachable state — `FORBIDDEN_PHRASES=[]` treated as falsy by `_load_forbidden_phrases()` [test_sanitization.py:194-201]
