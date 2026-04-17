# Story 1.2: Market Data Service

Status: done

## Story

As a System,
I want to fetch and cache live market data,
So that the agents have up-to-date context for their debate.

## Acceptance Criteria

1. **Given** a target asset (e.g., BTC, EURUSD, AAPL) **When** the service is triggered **Then** it fetches current price from yfinance (supports crypto, forex, and stocks)

2. **Given** the fetched data **When** processing is complete **Then** it is cached in Redis with a precise timestamp

3. **Given** a failure to fetch from provider **When** the provider is down **Then** the service returns the last cached data with a "Stale" flag (if < 1 min old) or a specific error code

## Tasks / Subtasks

- [x] Create market data service module (AC: #1, #2)
  - [x] Create `trade-app/fastapi_backend/app/services/market/__init__.py`
  - [x] Create `trade-app/fastapi_backend/app/services/market/provider.py` - abstraction for data providers
  - [x] Create `trade-app/fastapi_backend/app/services/market/cache.py` - Redis caching layer
  - [x] Create `trade-app/fastapi_backend/app/services/market/schemas.py` - Pydantic models

- [x] Implement yfinance provider (AC: #1)
  - [x] Add `yfinance>=0.2.0` dependency (replaces `aiohttp` and CoinGecko/Yahoo HTTP clients)
  - [x] Implement `YFinanceProvider` class wrapping sync yfinance calls in `run_in_executor`
  - [x] Fetch current price for crypto (BTC-USD), forex (EURUSD=X), and stocks (AAPL)
  - [x] Symbol routing via `get_yfinance_symbol()`: crypto → `{SYM}-USD`, 6-char alpha → `{SYM}=X`, else pass-through
  - [x] No rate limiting needed — yfinance is free with no enforced API limits

- [x] Implement Redis caching layer (AC: #2)
  - [x] Use `redis.asyncio.Redis` (async client - never sync)
  - [x] Create cache key strategy: `market:{asset}:price`, `market:{asset}:news`
  - [x] Store data with ISO 8601 timestamp
  - [x] Set TTL to 60 seconds
  - [x] Implement stale data detection with event emission

- [x] Implement failure handling (AC: #3)
  - [x] Try yfinance → return cached on failure
  - [x] If cache exists and < 60s old: return data with `isStale: true`
  - [x] If no cache or cache > 60s old: return error with specific code
  - [x] Emit `STALE_DATA` event for Story 1-6 consumers

- [x] Create market data API endpoints (AC: #1, #2, #3)
  - [x] Create `trade-app/fastapi_backend/app/routes/market.py`
  - [x] `GET /api/market/{asset}/data` - fetch price + news combined
  - [x] Return Standard Response Envelope format
  - [x] Register router in `trade-app/fastapi_backend/app/main.py`

- [x] Write tests (AC: All)
  - [x] Unit tests for `YFinanceProvider` with mocked `yf.Ticker`
  - [x] Unit tests for `get_yfinance_symbol()` and `normalize_asset()` symbol routing
  - [x] Unit tests for cache layer with mocked async Redis
  - [x] Integration tests for full flow with stale data fallback
  - [x] Test failure scenarios (provider down, stale data, unknown asset)

## Dev Notes

### 🚨 CRITICAL: Correct Project Paths

**Use Vinta starter structure from Story 1-1:**

```
trade-app/
├── fastapi_backend/
│   └── app/
│       ├── routes/
│       │   └── market.py          # NEW: Market API endpoints
│       ├── services/
│       │   └── market/            # NEW: Market data service
│       │       ├── __init__.py
│       │       ├── provider.py    # DataProvider ABC, providers
│       │       ├── cache.py       # MarketDataCache class
│       │       └── schemas.py     # Pydantic models
│       └── main.py                # Register market router
```

**NOT** `backend/app/...` - use `trade-app/fastapi_backend/app/...`

### 🚨 CRITICAL: Async Redis Client (Non-Blocking)

**MUST use async Redis client to avoid blocking event loop:**

```python
# pyproject.toml - add dependencies
dependencies = [
    # ... existing ...
    "yfinance>=0.2.0",         # Replaces aiohttp + CoinGecko/Yahoo HTTP calls
    "redis[hiredis]>=5.0.0",  # Includes async support
]

# cache.py - async usage
from redis.asyncio import Redis

class MarketDataCache:
    def __init__(self, url: str):
        self.client = Redis.from_url(url)
    
    async def get(self, key: str) -> dict | None:
        data = await self.client.get(key)
        return json.loads(data) if data else None
    
    async def set(self, key: str, value: dict, ttl: int = 60):
        await self.client.setex(key, ttl, json.dumps(value))
```

**NEVER use sync `redis.Redis` in async routes - violates NFR-01.**

### Service Interface (for Story 1-3 Debate Engine)

```python
# services/market/__init__.py
class MarketDataService:
    """Interface consumed by Debate Engine (Story 1-3)."""
    
    async def get_context(self, asset: str) -> MarketContext:
        """
        Returns formatted context for LLM prompts.
        Used by Bull/Bear agents to ground their arguments.
        """
        data = await self.get_data(asset)
        return MarketContext(
            asset=asset,
            price=data.price,
            news_summary=[n.title for n in data.news[:3]],
            is_stale=data.is_stale,
        )
```

### Pydantic Schemas

```python
# schemas.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List

class NewsItem(BaseModel):
    title: str
    url: str | None = None
    source: str = "unknown"
    timestamp: datetime

class MarketData(BaseModel):
    asset: str
    price: float
    currency: str = "usd"
    news: List[NewsItem] = []
    is_stale: bool = Field(default=False, serialization_alias="isStale")
    fetched_at: datetime = Field(serialization_alias="fetchedAt")

    class Config:
        populate_by_name = True
```

### API Endpoints

**`GET /api/market/{asset}/data`** - Combined price + news

**Response (Success):**
```json
{
  "data": {
    "asset": "bitcoin",
    "price": 45000.00,
    "currency": "usd",
    "news": [
      {"title": "Bitcoin ETF sees record inflows", "url": "...", "source": "coindesk", "timestamp": "..."}
    ],
    "isStale": false,
    "fetchedAt": "2026-02-19T10:00:00Z"
  },
  "error": null,
  "meta": {"latencyMs": 150, "provider": "coingecko"}
}
```

**Response (Error - All providers failed, no cache):**
```json
{
  "data": null,
  "error": {
    "code": "MARKET_DATA_UNAVAILABLE",
    "message": "Market data temporarily unavailable"
  },
  "meta": {}
}
```

### Provider Implementation

**YFinanceProvider (single provider, all asset classes):**
```
Library: yfinance>=0.2.0
Data lag: ~30 seconds (near real-time)
Rate limit: None enforced — free, no API key required
Asset coverage: Crypto, Forex, Stocks, ETFs
```

**Symbol Routing (`get_yfinance_symbol`):**
```python
# Crypto:  BTC / bitcoin  → BTC-USD
# Forex:   EURUSD         → EURUSD=X  (6-char alpha string)
# Stocks:  AAPL           → AAPL      (pass-through)

CRYPTO_SYMBOLS = {
    "BTC": "BTC-USD",
    "ETH": "ETH-USD",
    "SOL": "SOL-USD",
}
```

**Async wrapping (yfinance is sync):**
```python
async def fetch_price(self, asset: str) -> dict | None:
    symbol = get_yfinance_symbol(asset)
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, self._fetch_price_sync, symbol)
```

### Caching Strategy

```
Keys:
  - market:{asset_id}:price   # Price data + timestamp
  - market:{asset_id}:news    # News items + timestamp
TTL: 60 seconds (matches FR-16 stale threshold)
```

### Stale Data Event (for Story 1-6)

When returning stale data, include flag for Stale Data Guard:
```python
# In service response
if is_stale:
    # Story 1-6 will consume this to pause debates
    response["meta"]["staleWarning"] = True
```

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `MARKET_DATA_UNAVAILABLE` | 503 | All providers down, no cache |
| `INVALID_ASSET` | 400 | Asset not in supported list |

### Testing Standards

```python
# Mock yf.Ticker — no HTTP mocking needed
from unittest.mock import MagicMock, patch

def make_ticker_mock(price: float):
    mock_fi = MagicMock()
    mock_fi.last_price = price
    mock_t = MagicMock()
    mock_t.fast_info = mock_fi
    return mock_t

# Required test scenarios:
# 1. yfinance success → cache → return
# 2. yfinance returns None price → treat as failure
# 3. yfinance raises exception → stale cache → return with isStale=true
# 4. yfinance fails → no cache → 503 error
# 5. Cache hit → return cached (no provider call)
# 6. Forex symbol routing: EURUSD → EURUSD=X
```

### Performance Optimizations

**Cache Warming (Optional):**
```python
# On app startup, pre-fetch popular assets
POPULAR_ASSETS = ["BTC", "ETH", "SOL"]

@app.on_event("startup")
async def warm_cache():
    for asset in POPULAR_ASSETS:
        await market_service.fetch_and_cache(asset)
```

**Batch Fetching (Future):**
```python
# CoinGecko supports multiple assets in one call
GET /simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd
```

**Structured Logging:**
```python
import structlog
logger = structlog.get_logger()

logger.info("market_fetch", asset=asset, provider="coingecko", latency_ms=150, cached=False)
```

### References

- [Source: architecture.md#Project Structure]
- [Source: architecture.md#Implementation Patterns]
- [Source: project-context.md#Critical Implementation Rules]
- [Source: 1-1-project-initialization-infrastructure.md - Dev Notes, File List]
- [Source: FR-15, FR-16 from epics.md]
- [Source: NFR-01 (Stream Latency < 500ms)]

### Previous Story Intelligence (Story 1-1)

**Build upon:**
- Redis configured in `docker-compose.yml` (port 6379)
- `REDIS_URL` in `trade-app/fastapi_backend/app/config.py`
- Health endpoint pattern in `routes/health.py`
- CORS middleware already configured
- Token scrubbing middleware exists (for WebSocket auth)

**Existing files to reference:**
- `trade-app/fastapi_backend/app/config.py` - use `settings.REDIS_URL`
- `trade-app/fastapi_backend/app/main.py` - register new router
- `trade-app/docker-compose.yml` - Redis service

### Project Structure Notes

- Follow Vinta starter structure from Story 1-1 exactly
- Services go in `trade-app/fastapi_backend/app/services/`
- Routes go in `trade-app/fastapi_backend/app/routes/`
- Use existing `config.py` for settings
- Register router in `main.py`

### Naming Conventions

| Context | Convention | Example |
|---------|------------|---------|
| Python files | snake_case | `market_service.py` |
| Python classes | PascalCase | `CoinGeckoProvider` |
| Python variables | snake_case | `cached_price` |
| API JSON keys | camelCase | `isStale`, `fetchedAt` |

## Dev Agent Record

### Agent Model Used

glm-5 (zai-coding-plan/glm-5)

### Debug Log References

- aioresponses library had issues mocking aiohttp sessions created inside provider methods; resolved by mocking `_get_session` directly
- `is_cache_valid` is a sync method, needed MagicMock instead of AsyncMock in tests

### Completion Notes List

1. Created market data service module with 4 files: `__init__.py`, `provider.py`, `cache.py`, `schemas.py`
2. Implemented `CoinGeckoProvider` with async HTTP calls via aiohttp and Redis-based rate limiting (30 calls/min)
3. Implemented `YahooFinanceProvider` as fallback with same interface
4. Implemented `MarketDataCache` using async Redis client with 60s TTL and stale detection
5. Created `MarketDataService` with fallback chain: CoinGecko → Yahoo Finance → cached data
6. Created API endpoint `GET /api/market/{asset}/data` with Standard Response Envelope
7. Added `aiohttp>=3.9.0` and `aioresponses>=0.7.6` dependencies
8. Wrote 29 tests covering all scenarios: providers, cache, service, API endpoints
9. All 56 backend tests pass (27 existing + 29 new)
10. Ruff linting passes with no errors
11. Test quality review completed: 95/100 (A) - Approved
12. Frontend API tests updated: split 1-2-API-004 into 004a/004b, added mock header docs
13. **Code Review Fixes Applied** (2026-02-19):
    - Added support for lowercase asset names (bitcoin, ethereum, solana)
    - Changed INVALID_ASSET to return HTTP 400 instead of 200
    - Changed MARKET_DATA_UNAVAILABLE to return HTTP 503
    - Added `redis[hiredis]` dependency for C parser performance
    - Implemented mock middleware for test headers (X-Mock-Providers-Down, etc.)
    - Fixed is_stale flag consistency when returning cached data
    - Updated Pydantic models to use model_config (v2 syntax)
    - Added shared Redis connection manager
    - Added logging for timestamp parsing errors
    - Added timeout handling tests
14. **Provider Migration** (2026-04-17):
    - Replaced `CoinGeckoProvider` + `YahooFinanceProvider` (both HTTP-based) with `YFinanceProvider` (yfinance library)
    - CoinGecko removed: API is not free; Yahoo Finance direct HTTP removed: replaced by yfinance
    - yfinance covers crypto (BTC-USD), forex (EURUSD=X), and stocks (AAPL) — no API key required
    - Data lag ~30s (near real-time); tested and confirmed live
    - Added `get_yfinance_symbol()` for symbol routing; removed `RateLimiter` and `aiohttp` dependency
    - `MarketDataService` simplified: single `self.provider` replaces two-provider fallback chain
    - `pyproject.toml`: swapped `aiohttp>=3.9.0` for `yfinance>=0.2.0`
    - Provider tests fully rewritten: 16/16 passing, mocking `yf.Ticker` directly

### File List

**Created:**
- trade-app/fastapi_backend/app/services/market/__init__.py
- trade-app/fastapi_backend/app/services/market/provider.py
- trade-app/fastapi_backend/app/services/market/cache.py
- trade-app/fastapi_backend/app/services/market/schemas.py
- trade-app/fastapi_backend/app/routes/market.py
- trade-app/fastapi_backend/tests/services/market/__init__.py
- trade-app/fastapi_backend/tests/services/market/test_provider.py
- trade-app/fastapi_backend/tests/services/market/test_cache.py
- trade-app/fastapi_backend/tests/services/market/test_service.py
- trade-app/fastapi_backend/tests/routes/test_market.py

**Modified:**
- trade-app/fastapi_backend/app/main.py (registered market router, added mock middleware)
- trade-app/fastapi_backend/pyproject.toml (added aiohttp, aioresponses, redis[hiredis] dependencies)
- trade-app/fastapi_backend/app/config.py (added ENVIRONMENT setting)

**Created (Code Review Fixes):**
- trade-app/fastapi_backend/app/middleware/__init__.py
- trade-app/fastapi_backend/app/middleware/mock_middleware.py
- trade-app/fastapi_backend/app/services/redis_client.py

---

## Senior Developer Review (AI)

**Review Date**: 2026-02-19
**Review Workflow**: code-review v6.0
**Reviewer**: Adversarial Code Reviewer

### Issues Found

| Severity | Count | Status |
|----------|-------|--------|
| HIGH | 5 | ✅ All Fixed |
| MEDIUM | 5 | ✅ All Fixed |
| LOW | 2 | Deferred (cosmetic) |

### Issues Fixed

1. **[HIGH] Asset naming mismatch** - Added support for lowercase names (bitcoin, ethereum, solana) via `normalize_asset()` function
2. **[HIGH] Wrong HTTP status for invalid asset** - Changed from 200 to 400 for INVALID_ASSET
3. **[HIGH] Wrong HTTP status for unavailable data** - Changed from 200 to 503 for MARKET_DATA_UNAVAILABLE
4. **[HIGH] Missing hiredis extra** - Added `redis[hiredis]` to pyproject.toml
5. **[HIGH] Mock middleware not implemented** - Created `app/middleware/mock_middleware.py` with X-Mock-* header support
6. **[HIGH] is_stale flag inconsistency** - Fixed to properly set `is_stale=True` when returning stale cached data
7. **[MEDIUM] Pydantic v2 deprecated Config** - Updated all schemas to use `model_config = ConfigDict(...)`
8. **[MEDIUM] Multiple Redis connections** - Created shared `app/services/redis_client.py`
9. **[MEDIUM] Timestamp parsing silent errors** - Added logging for datetime parse failures
10. **[MEDIUM] Missing timeout tests** - Added timeout handling tests for CoinGecko provider

### Review Outcome

✅ **APPROVED** - All HIGH and MEDIUM issues fixed. Story status updated to "done".

---

## Test Quality Review

**Review Date**: 2026-02-19
**Review Workflow**: testarch-test-review v5.0
**Reviewer**: TEA Agent (Test Architect)

### Summary

| Metric | Value |
|--------|-------|
| **Quality Score** | 95/100 (A - Excellent) |
| **Recommendation** | ✅ Approved |
| **Test Files Reviewed** | 1 |
| **Tests Total** | 13 |

### Quality Dimension Scores

| Dimension | Score | Notes |
|-----------|-------|-------|
| Determinism | 95/100 | All conditional logic removed |
| Isolation | 85/100 | Read-only API tests, cleanup not critical |
| Maintainability | 100/100 | Full documentation, clear structure |
| Coverage | 95/100 | All ACs covered |
| Performance | 100/100 | Fast API tests |

### Test Coverage

**Frontend API Tests** (`tests/api/market-data.spec.ts`):
- P0 (Critical): 3 tests
- P1 (High): 4 tests
- P2 (Medium): 6 tests
- **Total**: 13 tests

**Backend Unit/Integration Tests**:
- Provider tests: `test_provider.py`
- Cache tests: `test_cache.py`
- Service tests: `test_service.py`
- API endpoint tests: `test_market.py`
- **Total**: 29 pytest tests

### Acceptance Criteria Validation

| AC | Description | Frontend Tests | Backend Tests |
|----|-------------|----------------|---------------|
| AC1 | Fetch price + news from provider | 1-2-API-001, 002 | test_provider.py, test_service.py |
| AC2 | Cache in Redis with timestamp | 1-2-API-001 | test_cache.py |
| AC3 | Failure handling (stale/error) | 1-2-API-004a, 004b, 007 | test_service.py, test_market.py |

**Coverage**: 3/3 criteria (100%)

### Recommendations Implemented

1. ✅ **Split test 1-2-API-004** - Removed conditional logic by splitting into two deterministic tests:
   - `1-2-API-004a`: Stale data with cached data scenario
   - `1-2-API-004b`: 503 error without cache scenario

2. ✅ **Document mock headers** - Added JSDoc comment documenting:
   - `X-Mock-Providers-Down`: Simulates provider unavailability
   - `X-Mock-All-Down`: Complete failure with cache bypass
   - `X-Mock-No-Cache`: Bypasses Redis cache

3. ⚠️ **Cleanup pattern** - Noted as not critical for read-only API tests

### Follow-up Actions

| Action | Priority | Target |
|--------|----------|--------|
| Implement mock middleware in FastAPI | P2 | Next sprint |
| Add cleanup pattern for write tests | P3 | Backlog |

### Artifacts

- **Test Review Report**: `_bmad-output/test-artifacts/test-review.md`
- **Test Automation Summary**: `_bmad-output/test-artifacts/automation-summary-1-2.md`
- **Test File**: `trade-app/nextjs-frontend/tests/api/market-data.spec.ts`

---

## QA Automation (2026-02-19)

**Workflow**: qa-automate v6.0
**Status**: ✅ Complete

### Test Execution Results

| Layer | Tests | Status |
|-------|-------|--------|
| Backend (pytest) | 32/32 | ✅ Passed |
| Frontend Jest | 31/31 | ✅ Passed |
| Frontend API (Playwright) | 13 | ✅ Generated |

### Backend Test Details

```
tests/services/market/test_provider.py  - 10 tests (CoinGecko/Yahoo providers)
tests/services/market/test_cache.py     - 7 tests (Redis cache layer)
tests/services/market/test_service.py   - 9 tests (MarketDataService)
tests/routes/test_market.py             - 6 tests (API endpoints)

32 passed, 2 warnings in 0.12s
```

### Frontend API Test Coverage

| Test ID | Scenario | Priority |
|---------|----------|----------|
| 1-2-API-001 | GET /api/market/{asset}/data returns valid response | P0 |
| 1-2-API-002 | Market data response matches Standard Response Envelope | P0 |
| 1-2-API-003 | Invalid asset returns 400 error | P0 |
| 1-2-API-004a | Stale data flag when providers down with cache | P1 |
| 1-2-API-004b | 503 when providers down without cache | P1 |
| 1-2-API-005 | Response time < 500ms (NFR-01) | P1 |
| 1-2-API-006 | Supported assets (bitcoin, ethereum, solana) | P2 |
| 1-2-API-007 | All providers down returns 503 | P1 |
| 1-2-API-008/009 | News data validation | P2 |

### Fixes Applied During QA

1. **Jest config** - Added `/tests/api/` to `testPathIgnorePatterns` to prevent Playwright tests from running in Jest

### Beads Sync

- ✓ Label `qa-automated` added to trade-b47
- ✓ Summary saved to `_bmad-output/implementation-artifacts/tests/test-summary.md`

### Commands to Run Tests

```bash
# Backend tests (Story 1-2 only)
cd trade-app/fastapi_backend
source venv/bin/activate && pytest tests/services/market/ tests/routes/test_market.py

# Frontend unit tests
cd trade-app/nextjs-frontend
pnpm test

# Frontend API tests (requires running backend)
cd trade-app/nextjs-frontend
pnpm exec playwright test tests/api/market-data.spec.ts
```
