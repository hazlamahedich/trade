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

## Deferred from: code review of 2-5-moderation-transparency-the-badge (2026-04-11)

- `isRedacted=true` with no `[REDACTED]` in content — backend inconsistency, spec says do NOT fix in UI
- `isRedacted=false/undefined` with `[REDACTED]` in content — dual-signal architecture is by design per spec separation-of-concerns
- `TooltipProvider` wraps all dashboard children — spec explicitly required layout-level placement
- `formatTime` invalid date handling — pre-existing, not introduced by this change
- Mobile text uses `text-violet-400/80` instead of `text-violet-400` — intentional subordination on mobile
- Mobile indicator lacks `bg-violet-600/20` background — intentional inline text design
- Mobile text may wrap on narrow viewports — pre-existing responsive behavior

## Deferred from: code review of 3-1-voting-api-data-model (2026-04-11)

- Lazy limiter init not thread-safe — `_get_vote_limiter()` / `_get_capacity_limiter()` use check-then-set on globals with no lock. Low risk in practice (CPython GIL, single-event-loop uvicorn). Pre-existing pattern from `get_debate_service()`. [app/routes/debate.py:46-57]
- Capacity limiter semantics — 60s sliding window means "10K votes per minute" not "10K total active voters". If the intent was a hard cap, the limiter design is wrong. Requires product clarification. [app/services/rate_limiter.py:100-107]
- DB write consumes capacity counter on failure — `check("global")` increments counter before DB write at Guard 6. If write fails, capacity slot is wasted. Pre-existing architectural limitation of the `RateLimiter` design (INCR-before-check).

## Deferred from: code review of 3-2-voting-ui-components (2026-04-12)

- Voter fingerprint trivially spoofable — no server-side identity verification [api.ts:104-114] — spec acknowledges as acceptable: anonymous-first design with server-side rate limiting
- No CSRF protection on vote POST [api.ts:68-72] — anonymous-first design makes CSRF tokens impractical; server-side rate limiting is the guard
- fetchDebateResult doesn't validate response shape [api.ts:92-102] — pattern consistent with rest of codebase (no runtime validation on API responses)
- crypto.randomUUID fails in non-secure context (HTTP without localhost) [api.ts:111] — Next.js apps typically run on localhost or HTTPS
- Vote in-flight during Guardian freeze — error toast may be obscured by overlay [VoteControls.tsx:26, useVote.ts:98-100] — low priority; guardian overlay is blocking, toast visible after dismissal
- useVotingStatus never refetches on live debate [useVotingStatus.ts:28-32] — explicitly Story 3.4 scope; spec says "Full real-time polling/WebSocket updates are Story 3.4"
- useMutation object in useCallback dependency — memoization ineffective [useVote.ts:111] — cosmetic; race guard via ref is the real protection

## Deferred from: code review of 3-3-sentiment-aggregation-service (2026-04-12)

- Benchmark tests repo layer not HTTP endpoint — AC2 specifies `GET /api/debate/{id}/result` but test calls repo directly [`test_sentiment_benchmark.py:72`] — test architecture decision; repo-only benchmark isolates query performance from HTTP overhead
- String-based query detection in `test_no_redundant_count_query` fragile across SQLAlchemy versions [`test_vote_repository.py:353`] — pre-existing test pattern, functional with current asyncpg dialect
