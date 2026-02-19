# Story 1.3: Debate Engine Core (LangGraph)

Status: done

## Story

As a User,
I want the system to orchestrate a discussion between Bull and Bear agents,
So that I can read their opposing arguments based on the same data.

## Acceptance Criteria

1. **Given** a valid market context **When** the debate starts **Then** the Bull agent generates an argument specifically citing the data

2. **Given** the construction of the Bull's argument **When** it is complete **Then** the Bear agent generates a counter-argument that explicitly references the Bull's points

3. **Given** the LangGraph workflow **When** executing the debate loop **Then** it strictly maintains the state of the conversation and agent turn order

## Tasks / Subtasks

- [x] Create LangGraph workflow module (AC: #3)
  - [x] Create `trade-app/fastapi_backend/app/services/debate/__init__.py`
  - [x] Create `trade-app/fastapi_backend/app/services/debate/engine.py` - LangGraph workflow
  - [x] Create `trade-app/fastapi_backend/app/services/debate/state.py` - Typed state definitions
  - [x] Create `trade-app/fastapi_backend/app/services/debate/schemas.py` - Pydantic models
  - [x] Create `trade-app/fastapi_backend/app/services/debate/exceptions.py` - Custom exceptions

- [x] Implement Bull Agent (AC: #1)
  - [x] Create `trade-app/fastapi_backend/app/services/debate/agents/__init__.py`
  - [x] Create `trade-app/fastapi_backend/app/services/debate/agents/bull.py`
  - [x] Define Bull persona prompt (optimistic, growth-focused)
  - [x] Agent receives MarketContext and generates argument citing data

- [x] Implement Bear Agent (AC: #2)
  - [x] Create `trade-app/fastapi_backend/app/services/debate/agents/bear.py`
  - [x] Define Bear persona prompt (skeptical, risk-focused)
  - [x] Agent receives Bull's argument and generates counter referencing Bull's points

- [x] Implement Debate Engine orchestration (AC: #3)
  - [x] Create LangGraph StateGraph with Bull/Bear nodes
  - [x] Implement turn-taking logic (Bull -> Bear -> Bull -> Bear...)
  - [x] Maintain conversation state (messages, turn count, status)
  - [x] Add max turns configuration (default: 6 turns)

- [x] Integrate with Market Data Service (AC: #1)
  - [x] Import `MarketDataService.get_context()` from Story 1-2
  - [x] Pass MarketContext to Bull agent as input

- [x] Create debate API endpoint (AC: #1, #2, #3)
  - [x] Create `trade-app/fastapi_backend/app/routes/debate.py`
  - [x] `POST /api/debate/start` - Initialize new debate with asset
  - [x] Return Standard Response Envelope format
  - [x] Register router in `main.py`

- [x] Write tests (AC: All)
  - [x] Unit tests for Bull agent with mocked LLM
  - [x] Unit tests for Bear agent with mocked LLM
  - [x] Unit tests for LangGraph workflow state transitions
  - [x] Integration test for full debate flow
  - [x] Create `tests/services/debate/conftest.py` for shared fixtures

## Dev Notes

### 🚨 CRITICAL: Correct Project Paths

**Use Vinta starter structure from Story 1-1/1-2:**

```
trade-app/
├── fastapi_backend/
│   └── app/
│       ├── routes/
│       │   └── debate.py            # NEW: Debate API endpoints
│       ├── services/
│       │   ├── market/              # From Story 1-2
│       │   └── debate/              # NEW: Debate engine
│       │       ├── __init__.py      # DebateService export
│       │       ├── engine.py        # LangGraph StateGraph
│       │       ├── state.py         # DebateState TypedDict
│       │       ├── schemas.py       # Pydantic response models
│       │       ├── exceptions.py    # StaleDataError, etc.
│       │       └── agents/
│       │           ├── __init__.py
│       │           ├── bull.py      # BullAgent class
│       │           └── bear.py      # BearAgent class
│       └── main.py                  # Register debate router
```

**NOT** `backend/app/...` - use `trade-app/fastapi_backend/app/...`

### 🚨 CRITICAL: LangGraph Dependencies

**Add to pyproject.toml (follow existing version pinning pattern):**

```toml
[project]
dependencies = [
    # ... existing ...
    "langgraph>=0.2.0,<0.3",
    "langchain-core>=0.3.0,<0.4",
    "langchain-openai>=0.2.0,<0.3",
]
```

### 🚨 CRITICAL: Config Pattern (Match Existing Codebase)

**Add to `app/config.py` following pydantic_settings pattern:**

```python
# config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # ... existing settings ...
    
    # LLM Configuration
    openai_api_key: str = ""
    debate_max_turns: int = 6
    debate_llm_model: str = "gpt-4o-mini"
    debate_llm_temperature: float = 0.7

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

settings = Settings()
```

### 🚨 CRITICAL: Custom Exceptions

**Create `app/services/debate/exceptions.py`:**

```python
# exceptions.py

class StaleDataError(Exception):
    """Raised when market data is stale and cannot start debate."""
    pass


class DebateAlreadyRunningError(Exception):
    """Raised when a debate is already active for the asset."""
    pass


class LLMProviderError(Exception):
    """Raised when LLM provider fails (NFR-07 failover exhausted)."""
    pass
```

### 🚨 CRITICAL: LangGraph StateGraph Pattern

**state.py:**

```python
# state.py
from typing import TypedDict, Annotated
from langgraph.graph import add_messages


class DebateState(TypedDict):
    asset: str
    market_context: dict
    messages: Annotated[list[dict], add_messages]
    current_turn: int
    max_turns: int
    current_agent: str  # "bull" | "bear"
    status: str  # "running" | "completed" | "paused"
```

**engine.py:**

```python
# engine.py
import logging
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from app.services.debate.state import DebateState
from app.services.debate.agents.bull import BullAgent
from app.services.debate.agents.bear import BearAgent

logger = logging.getLogger(__name__)


def should_continue(state: DebateState) -> bool:
    """Check if debate should continue."""
    return state["current_turn"] < state["max_turns"]


def bull_agent_node(state: DebateState) -> dict:
    agent = BullAgent()
    result = agent.generate(state)
    logger.info(f"Bull agent generated argument, turn {state['current_turn']}")
    return result


def bear_agent_node(state: DebateState) -> dict:
    agent = BearAgent()
    result = agent.generate(state)
    logger.info(f"Bear agent generated argument, turn {state['current_turn']}")
    return result


def create_debate_graph():
    workflow = StateGraph(DebateState)
    
    # Add nodes
    workflow.add_node("bull", bull_agent_node)
    workflow.add_node("bear", bear_agent_node)
    
    # Conditional exit after max_turns
    workflow.add_conditional_edges(
        "bull",
        should_continue,
        {True: "bear", False: END}
    )
    workflow.add_conditional_edges(
        "bear",
        should_continue,
        {True: "bull", False: END}
    )
    
    workflow.set_entry_point("bull")
    return workflow.compile(checkpointer=MemorySaver())
```

### Agent Implementation Pattern

**Pure Agent Classes (no HTTP/DB knowledge):**

```python
# agents/bull.py
import logging
import re
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from app.services.debate.state import DebateState
from app.config import settings

logger = logging.getLogger(__name__)

BULL_SYSTEM_PROMPT = """You are the BULL agent in a trading debate.
Your role is to present OPTIMISTIC arguments for buying the asset.

CRITICAL RULES:
1. ALWAYS cite specific market data points (price, news)
2. Be confident but not promissory - NEVER say "guaranteed" or "risk-free"
3. Reference the Bear's counter-points when responding
4. Keep arguments concise (2-3 sentences max)

Market Context:
{market_context}

Previous Bear Argument (if any):
{bear_argument}

Generate your bullish argument:"""


class BullAgent:
    def __init__(self, llm=None):
        self.llm = llm or ChatOpenAI(
            model=settings.debate_llm_model,
            temperature=settings.debate_llm_temperature,
        )
        self.prompt = ChatPromptTemplate.from_template(BULL_SYSTEM_PROMPT)
    
    def _get_last_bear_message(self, state: DebateState) -> str:
        for msg in reversed(state.get("messages", [])):
            if msg.get("role") == "bear":
                return msg.get("content", "")
        return ""
    
    def generate(self, state: DebateState) -> dict:
        chain = self.prompt | self.llm
        response = chain.invoke({
            "market_context": state["market_context"],
            "bear_argument": self._get_last_bear_message(state),
        })
        content = sanitize_response(response.content)
        return {
            "messages": [{"role": "bull", "content": content}],
            "current_turn": state["current_turn"] + 1,
            "current_agent": "bear",
        }


def sanitize_response(content: str) -> str:
    """Pre-Guardian filter for forbidden phrases (Story 2-4 will add regex)."""
    forbidden = [
        "guaranteed", "risk-free", "safe bet", "sure thing",
        "100%", "certainly will", "always goes"
    ]
    for phrase in forbidden:
        pattern = re.compile(re.escape(phrase), re.IGNORECASE)
        if pattern.search(content):
            content = pattern.sub("[REDACTED]", content)
            logger.warning(f"Redacted forbidden phrase: {phrase}")
    return content
```

### Integration with Market Data Service (Story 1-2)

```python
# debate/__init__.py
import uuid
import logging
from app.services.market import MarketDataService
from app.services.market.schemas import MarketContext
from app.services.debate.engine import create_debate_graph
from app.services.debate.schemas import DebateResponse
from app.services.debate.exceptions import StaleDataError

logger = logging.getLogger(__name__)


class DebateService:
    def __init__(self):
        self.market_service = MarketDataService()
        self.graph = create_debate_graph()
    
    async def start_debate(self, asset: str) -> DebateResponse:
        # Get market context from Story 1-2
        market_context = await self.market_service.get_context(asset)
        
        if market_context.is_stale:
            logger.warning(f"Stale data detected for {asset}, blocking debate")
            raise StaleDataError("Cannot start debate with stale data")
        
        debate_id = f"deb_{uuid.uuid4().hex[:8]}"
        
        initial_state = {
            "asset": asset,
            "market_context": market_context.model_dump(),
            "messages": [],
            "current_turn": 0,
            "max_turns": 6,
            "current_agent": "bull",
            "status": "running",
        }
        
        logger.info(f"Starting debate {debate_id} for {asset}")
        result = await self.graph.ainvoke(initial_state)
        
        return DebateResponse(
            debate_id=debate_id,
            asset=asset,
            status="completed",
            messages=result["messages"],
            current_turn=result["current_turn"],
            max_turns=result["max_turns"],
        )
```

### Pydantic Schemas (Match Story 1-2 Pattern)

```python
# schemas.py
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class DebateMessage(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    role: str = Field(..., description="bull | bear")
    content: str


class DebateStartRequest(BaseModel):
    asset: str = Field(..., min_length=1, max_length=20)


class DebateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    debate_id: str = Field(serialization_alias="debateId")
    asset: str
    status: str
    messages: list[DebateMessage]
    current_turn: int = Field(serialization_alias="currentTurn")
    max_turns: int = Field(serialization_alias="maxTurns")
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        serialization_alias="createdAt"
    )


class DebateMeta(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    latency_ms: int = Field(serialization_alias="latencyMs")


class DebateErrorResponse(BaseModel):
    code: str
    message: str


class StandardDebateResponse(BaseModel):
    """Standard Response Envelope matching market.py pattern."""
    model_config = ConfigDict(populate_by_name=True)

    data: DebateResponse | None = None
    error: DebateErrorResponse | None = None
    meta: DebateMeta | dict[str, Any] = {}
```

### API Endpoints (Match Story 1-2 Router Pattern)

**`trade-app/fastapi_backend/app/routes/debate.py`:**

```python
# routes/debate.py
import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from app.services.debate import DebateService
from app.services.debate.schemas import (
    DebateStartRequest,
    StandardDebateResponse,
    DebateResponse,
    DebateMeta,
    DebateErrorResponse,
)
from app.services.debate.exceptions import StaleDataError

router = APIRouter(prefix="/api/debate", tags=["debate"])

logger = logging.getLogger(__name__)

debate_service = DebateService()


@router.post("/start", response_model=StandardDebateResponse)
async def start_debate(request: DebateStartRequest) -> StandardDebateResponse:
    try:
        result = await debate_service.start_debate(request.asset)
        return StandardDebateResponse(
            data=result,
            error=None,
            meta=DebateMeta(latency_ms=0)
        )
    except StaleDataError:
        raise HTTPException(
            status_code=400,
            detail={
                "data": None,
                "error": {
                    "code": "STALE_MARKET_DATA",
                    "message": "Market data is older than 60 seconds. Cannot start debate.",
                },
                "meta": {},
            },
        )
    except Exception as e:
        logger.error(f"Error starting debate for {request.asset}: {e}")
        raise HTTPException(
            status_code=503,
            detail={
                "data": None,
                "error": {
                    "code": "LLM_PROVIDER_ERROR",
                    "message": "LLM service temporarily unavailable",
                },
                "meta": {},
            },
        )
```

**Register in `main.py`:**

```python
# main.py - Add after existing imports
from app.routes.debate import router as debate_router

# Add after other router registrations
app.include_router(debate_router)
```

### Testing Standards

**Create `tests/services/debate/conftest.py`:**

```python
# tests/services/debate/conftest.py
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.market.schemas import MarketContext


@pytest.fixture
def mock_llm():
    llm = MagicMock()
    llm.invoke = MagicMock(return_value=MagicMock(content="Test argument"))
    return llm


@pytest.fixture
def mock_market_service():
    service = AsyncMock()
    service.get_context = AsyncMock(return_value=MarketContext(
        asset="bitcoin",
        price=45000.0,
        news_summary=["Bitcoin ETF approved"],
        is_stale=False,
    ))
    return service


@pytest.fixture
def stale_market_service():
    service = AsyncMock()
    service.get_context = AsyncMock(return_value=MarketContext(
        asset="bitcoin",
        price=45000.0,
        news_summary=["Bitcoin ETF approved"],
        is_stale=True,
    ))
    return service
```

**Required test scenarios:**

| Test | Description | File |
|------|-------------|------|
| test_bull_generates_argument | Bull cites market data | `test_agents.py` |
| test_bear_references_bull | Bear counters Bull's points | `test_agents.py` |
| test_state_transitions | Bull -> Bear -> Bull flow | `test_engine.py` |
| test_max_turns_stops | Debate stops at max_turns | `test_engine.py` |
| test_stale_data_blocks | Stale data raises error | `test_service.py` |
| test_forbidden_phrase_redacted | Sanitizer works | `test_agents.py` |
| test_full_debate_flow | End-to-end integration | `test_service.py` |

### Performance Requirements (NFR-01)

**TTFT < 500ms for streaming (Story 1-4):**
- This story establishes synchronous debate completion
- Story 1-4 will add token-by-token streaming via WebSocket
- Use async LLM calls (`ainvoke`) to prepare for streaming

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `STALE_MARKET_DATA` | 400 | Market data > 60s old |
| `INVALID_ASSET` | 400 | Asset not supported |
| `DEBATE_ALREADY_RUNNING` | 409 | Debate already active for asset |
| `LLM_PROVIDER_ERROR` | 503 | LLM API failure (NFR-07 failover exhausted) |

### Mock Middleware for Testing (Optional Enhancement)

**Add to `mock_middleware.py` for LLM failover testing:**

```python
# In MockHeadersMiddleware._process_headers()
elif header_key == "x-mock-llm-failover":
    request.state.mock_llm_failover = True
```

### References

- [Source: architecture.md#Project Structure - services/debate/]
- [Source: architecture.md#Communication Patterns - WebSocket Actions]
- [Source: architecture.md#Implementation Patterns - Pydantic alias]
- [Source: epics.md#Story 1.3 Acceptance Criteria]
- [Source: FR-01, FR-02, FR-03]
- [Source: NFR-01 (Stream Latency < 500ms)]
- [Source: NFR-07 (LLM Failover)]
- [Source: 1-2-market-data-service.md - MarketContext, StandardResponse pattern]

### Previous Story Intelligence (Story 1-2)

**Build upon:**
- `MarketDataService` in `app/services/market/`
- `MarketContext` Pydantic model with `is_stale` flag
- Standard Response Envelope pattern (`data`, `error`, `meta`)
- Shared Redis client in `app/services/redis_client.py`
- Mock middleware pattern in `app/middleware/mock_middleware.py`

**Exact imports from Story 1-2:**
```python
from app.services.market import MarketDataService
from app.services.market.schemas import MarketContext
from app.services.redis_client import get_redis_client
from app.config import settings
```

**Learnings from Story 1-2:**
- Use `model_config = ConfigDict(...)` for Pydantic v2 (not deprecated `Config` class)
- Use `serialization_alias` for camelCase API output
- Return proper HTTP status codes (400/503, not 200 for errors)
- Use `logger = logging.getLogger(__name__)` pattern
- HTTPException with `detail` dict for standard envelope format

### Project Structure Notes

- Follow Vinta starter structure exactly
- Services go in `trade-app/fastapi_backend/app/services/`
- Routes go in `trade-app/fastapi_backend/app/routes/`
- Test fixtures in `tests/services/debate/conftest.py`
- Register router in `main.py` without additional prefix

### Naming Conventions

| Context | Convention | Example |
|---------|------------|---------|
| Python files | snake_case | `debate_engine.py` |
| Python classes | PascalCase | `DebateService`, `BullAgent` |
| Python variables | snake_case | `market_context` |
| API JSON keys | camelCase | `debateId`, `currentTurn` |
| LangGraph nodes | lowercase | `bull`, `bear` |

### Future: Guardian Agent (Story 2-1)

**Note:** Story 2-1 will add `GuardianAgent` as a third node in the workflow:
- Will interject on dangerous logic
- Will generate "Summary Verdict" 
- Current architecture supports adding node between turns

### Web Intelligence (Latest LangGraph)

**LangGraph 0.2+ Key Patterns:**
- Use `StateGraph` with `Annotated` types for message accumulation
- `add_messages` reducer for appending to message lists
- `MemorySaver` for in-memory checkpointing (production will use Postgres)
- `ainvoke()` for async execution
- Conditional edges with `add_conditional_edges()`

**LLM Provider Failover (NFR-07):**
```python
# Future: Story 2 will implement full failover
# For now, structure agents to support it:
async def get_llm_with_failover():
    try:
        return ChatOpenAI(model=settings.debate_llm_model)
    except Exception:
        # NFR-07: Auto-switch provider if primary fails
        # from langchain_anthropic import ChatAnthropic
        # return ChatAnthropic(model="claude-3-haiku")
        raise LLMProviderError("All LLM providers failed")
```

## Dev Agent Record

### Agent Model Used

zai-coding-plan/glm-5

### Debug Log References

None required - all tests passing.

### Completion Notes List

- Implemented LangGraph-based debate engine with Bull/Bear agent orchestration
- Created StateGraph with conditional edges for turn-taking logic (Bull -> Bear -> Bull -> Bear...)
- Integrated with existing MarketDataService from Story 1-2
- Added forbidden phrase sanitization for compliance (pre-Guardian filter)
- Used simple list-based message storage (avoiding LangGraph's `add_messages` reducer for custom roles)
- Extracted shared sanitization module with pre-compiled regex for performance
- Added asset whitelist validation with case normalization
- Fixed deprecated `datetime.utcnow()` to use timezone-aware alternative
- Added defensive type checking for LLM response content
- All 38 debate tests pass + no regressions in full suite
- Linting passes with ruff

### Test Coverage Summary

**Backend (Python):** 38 tests
- `test_agents.py`: 13 tests (Bull/Bear agent behavior, forbidden phrase redaction, **case-insensitivity**)
- `test_engine.py`: 7 tests (state transitions, max turns, graph structure)
- `test_service.py`: 11 tests (service integration, stale data handling, **boundary tests**, **concurrent isolation**)
- `test_routes/test_debate.py`: 7 tests (API routes, error handling, **asset validation**)

**Frontend (Playwright):** 22 tests (generated via testarch-automate)
- `tests/api/debate-api.spec.ts`: 12 tests (API contract, validation, error scenarios)
- `tests/e2e/debate-flow.spec.ts`: 10 tests (E2E user journeys, error handling, UX)

**Total:** 60 tests covering all 3 acceptance criteria

### Risk Mitigation Tests (testarch-test-design)

| Risk ID | Description | Tests Added | Status |
|---------|-------------|-------------|--------|
| R-3.1 | LLM non-determinism | Mock LLM in all tests | ✅ Complete |
| R-3.2 | Stale data edge cases | `TestStaleDataBoundary` (3 tests) | ✅ Complete |
| R-3.3 | Concurrent debate isolation | `TestConcurrentDebateIsolation` (2 tests) | ✅ Complete |
| R-3.4 | Forbidden phrase bypass | `TestSanitizeResponseCaseInsensitivity` (5 tests) | ✅ Complete |

### File List

**Created:**
- trade-app/fastapi_backend/app/services/debate/__init__.py
- trade-app/fastapi_backend/app/services/debate/engine.py
- trade-app/fastapi_backend/app/services/debate/state.py
- trade-app/fastapi_backend/app/services/debate/schemas.py
- trade-app/fastapi_backend/app/services/debate/exceptions.py
- trade-app/fastapi_backend/app/services/debate/agents/__init__.py
- trade-app/fastapi_backend/app/services/debate/agents/bull.py
- trade-app/fastapi_backend/app/services/debate/agents/bear.py
- trade-app/fastapi_backend/app/routes/debate.py
- trade-app/fastapi_backend/tests/services/debate/__init__.py
- trade-app/fastapi_backend/tests/services/debate/conftest.py
- trade-app/fastapi_backend/tests/services/debate/test_agents.py
- trade-app/fastapi_backend/tests/services/debate/test_engine.py
- trade-app/fastapi_backend/tests/services/debate/test_service.py
- trade-app/fastapi_backend/tests/routes/test_debate.py

**Created (Frontend Tests - testarch-automate):**
- trade-app/nextjs-frontend/tests/api/debate-api.spec.ts
- trade-app/nextjs-frontend/tests/e2e/debate-flow.spec.ts

**Modified:**
- trade-app/fastapi_backend/pyproject.toml (added langgraph, langchain-core, langchain-openai deps)
- trade-app/fastapi_backend/app/config.py (added LLM settings: openai_api_key, debate_max_turns, debate_llm_model, debate_llm_temperature)
- trade-app/fastapi_backend/app/main.py (registered debate_router)
- trade-app/fastapi_backend/app/services/debate/agents/bull.py (refactored to use shared sanitization, added defensive content check)
- trade-app/fastapi_backend/app/services/debate/agents/bear.py (refactored to use shared sanitization, added defensive content check)
- trade-app/fastapi_backend/app/services/debate/schemas.py (fixed deprecated datetime.utcnow, added asset whitelist validation)
- trade-app/fastapi_backend/tests/services/debate/test_agents.py (updated to use shared sanitization module)
- trade-app/fastapi_backend/tests/routes/test_debate.py (added asset validation tests)

**Created (Code Review Fixes):**
- trade-app/fastapi_backend/app/services/debate/sanitization.py (extracted shared sanitization with pre-compiled regex)

**Modified (Code Review Round 2):**
- trade-app/fastapi_backend/app/services/debate/agents/bull.py (converted to async with `ainvoke`)
- trade-app/fastapi_backend/app/services/debate/agents/bear.py (converted to async with `ainvoke`)
- trade-app/fastapi_backend/app/services/debate/engine.py (made node functions async, added type hints)
- trade-app/fastapi_backend/app/services/debate/__init__.py (added API key validation)
- trade-app/fastapi_backend/app/services/debate/exceptions.py (added docstring for unused exception)
- trade-app/fastapi_backend/app/routes/debate.py (lazy service init, added LLMProviderError handling)
- trade-app/fastapi_backend/app/config.py (added `validate_llm_config()` method)
- trade-app/fastapi_backend/tests/services/debate/test_agents.py (updated mocks for async)
- trade-app/fastapi_backend/tests/services/debate/test_engine.py (updated mocks for async)
- trade-app/fastapi_backend/tests/services/debate/test_service.py (added validation mock)
- trade-app/fastapi_backend/tests/routes/test_debate.py (updated to mock `get_debate_service`)

## Change Log

- 2026-02-19: **Code Review Round 2 Complete** - Fixed 6 issues (2 HIGH, 4 MEDIUM), converted agents to async
- 2026-02-19: **Code Review Complete** - Fixed 7 issues (3 HIGH, 4 MEDIUM), added 2 new tests
- 2026-02-19: Completed testarch-test-design workflow - added 10 P1 gap tests, fixed case-insensitive sanitization bug
- 2026-02-19: Completed testarch-automate workflow - generated 22 frontend tests (12 API, 10 E2E)
- 2026-02-19: Completed implementation of Story 1-3 Debate Engine Core (LangGraph)

## Code Review Fixes (Round 1)

| Issue | Severity | Fix |
|-------|----------|-----|
| Code Duplication (DRY) | HIGH | Extracted `sanitize_response` to `sanitization.py` |
| Deprecated `datetime.utcnow()` | HIGH | Changed to `datetime.now(timezone.utc)` |
| Regex Inefficiency | MEDIUM | Pre-compiled patterns at module level |
| No Asset Validation | MEDIUM | Added whitelist validator with normalization |
| Missing Defensive Coding | MEDIUM | Added type check for LLM response.content |
| Test Reference Updates | MEDIUM | Updated tests to use shared sanitization |

**Tests Added by Code Review:** 2
- `test_start_debate_unsupported_asset` - validates asset whitelist
- `test_start_debate_normalizes_asset` - validates case normalization

## Code Review Fixes (Round 2)

| Issue | Severity | Fix |
|-------|----------|-----|
| Synchronous LLM Calls | HIGH | Converted `chain.invoke()` to `chain.ainvoke()` for async |
| Sync Engine Node Functions | HIGH | Made `bull_agent_node` and `bear_agent_node` async |
| No API Key Validation | MEDIUM | Added `validate_llm_config()` method with startup check |
| LLMProviderError Not Used | MEDIUM | Added explicit LLMProviderError handling in routes |
| MemorySaver Not Documented | MEDIUM | Added TODO comment for production PostgresSaver |
| DebateAlreadyRunningError Unused | MEDIUM | Added docstring noting future use (Story 1-4/1-6) |

**Tests Updated:** All 38 tests updated for async patterns
- `test_agents.py` - Updated mocks to use `ainvoke` with `AsyncMock`
- `test_engine.py` - Updated node function mocks to use `AsyncMock`
- `test_service.py` - Added `validate_llm_config` mock to fixtures
- `test_routes.py` - Updated to mock `get_debate_service()` instead of global
