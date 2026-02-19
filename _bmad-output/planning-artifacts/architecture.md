---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - prd.md
  - ux-design-specification.md
  - project-context.md
  - research/domain-AI_Trading_Debate_Lab-research-2026-02-18.md
  - research/technical-AI_Trading_Debate_Lab-research-2026-02-18.md
workflowType: 'architecture'
project_name: 'trade'
user_name: 'team mantis a'
date: '2026-02-18'
lastStep: 8
status: 'complete'
completedAt: '2026-02-18'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
- **Core Engine:** Live debating system with 3 agents (Bull, Bear, Risk Guardian).
- **Real-time:** Streaming arguments (FR-01) and "active waiting" UI updates.
- **Data Integration:** Live market data connection with strict freshness checks (FR-15, FR-16).
- **Compliance:** Real-time filtering and strict disclaimer enforcement (FR-08).

**Non-Functional Requirements:**
- **Performance:** **TTFT < 500ms** (streaming) to meet immediate engagement goals, accepting total generation time may be longer.
- **Scalability:** 50k concurrent viewers (Read), 10k voters (Write).
- **Reliability:** 99.9% uptime, LLM failover strategies (NFR-07).
- **Security:** Vote integrity and tamper-evident logs (NFR-08, NFR-09).

**Scale & Complexity:**
- **Primary Domain:** Fintech / Web App (Agentic AI).
- **Complexity Level:** High (Real-time orchestration + Regulatory safety).
- **Estimated Components:** ~5-7 (Frontend, API Gateway, Orchestrator, Agent Ecosystem, Market Data Service, DB, Redis/Cache).

### Technical Constraints & Dependencies

- **Stack Enforcement:** Next.js (Frontend) + FastAPI (Backend) as per Project Context.
- **Protocol Decision:** **WebSockets** selected (overriding PRD's SSE suggestion) to enable bi-directional interaction for the Argument Graph.
- **Regulatory:** "No Advice" boundary requires strict architectural separation involving a **Deterministic Safety Layer** (Regex/Keyword) *outside* the LLM.
- **Data:** Dependency on external market data providers.

### Cross-Cutting Concerns Identified

- **Observability:** Distributed tracing for agent thought processes.
- **Testability:** Architecture must support **Simulated Clock & Market Data Injection** to verify time-based logic (e.g., stale data pauses).
- **State Management:** Syncing complex debate state between Python backend and React frontend.

## Starter Template Evaluation

### Primary Technology Domain

**Full-Stack Web Application** (Next.js Frontend + FastAPI Backend)

### Starter Options Considered

1.  **Vinta Software `nextjs-fastapi-template`:** Best for type safety, production readiness, and modern stack integration.
2.  **`next-fast-turbo`:** Best for strict monorepo (Turborepo) structure.
3.  **LangGraph Starters:** Too specific/experimental; better to layer LangGraph onto a solid foundation.

### Selected Starter: Vinta Software `nextjs-fastapi-template`

**Rationale for Selection:**
Selected for its **End-to-End Type Safety** (Pydantic -> TypeScript generation), which directly addresses the "Complexity" and "Reliability" risks in the PRD. It provides a "Glass Box" development experience where frontend errors are caught at compile time.

**Initialization Command:**

```bash
git clone https://github.com/vintasoftware/nextjs-fastapi-template.git trade-app
cd trade-app
npm install
pip install -r requirements.txt
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- **Frontend:** TypeScript + Next.js 14 (App Router).
- **Backend:** Python 3.11+ + FastAPI.

**Styling Solution:**
- **Tailwind CSS** + **Shadcn/UI** (Matches UX requirements).

**Data & State:**
- **React Query** for server state management.
- **Zod** for frontend validation.

**Testing Framework:**
- **Pytest** (Backend) + **Jest/Vitest** (Frontend).

**Code Organization:**
- **Frontend/Backend Split:** Distinct directories for clean separation of concerns.
- **API Client Generation:** Automated script to keep frontend types in sync with backend schema.

**Development Experience:**
- **Hot Reload:** Simultaneous frontend and backend hot reloading.
- **Docker:** Ready-to-use Docker Compose setup for consistent environments.

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1.  **Infrastructure Split:** Decoupling frontend/backend hosting to enable WebSockets.
2.  **Authentication Strategy:** Sticking with starter default vs. managed service.
3.  **Database Provider:** Choosing a PostgreSQL host compatible with the backend.
4.  **Real-time Protocol:** Selecting the specific WebSocket implementation.

**Important Decisions (Shape Architecture):**
- **State Management:** React Query (Server) vs. Zustand (Client).
- **Agent Orchestration:** LangGraph (Python) state persistence.

### Infrastructure & Deployment

**Decision: Split Stack Hosting**
- **Frontend:** **Vercel** (Best-in-class for Next.js 14 App Router & Edge capabilities).
- **Backend:** **Railway** (Docker Container).
- **Rationale:** The Vinta starter is optimized for Vercel, BUT Vercel Serverless Functions **do not support WebSockets**. To meet the requirement for a bi-directional "Interactive Argument Graph," the backend must run in a persistent container (Railway/Render) while the frontend benefits from Vercel's global CDN.
- **Cascading Implication:** We will need to configure CORS carefully between `trade-app.vercel.app` and `api.trade-app.railway.app`.

### Authentication & Security

**Decision: Keep `fastapi-users` (Starter Default)**
- **Rationale:** While managed services like Clerk are easier, replacing the starter's deeply integrated auth system would burn significant "setup tokens" on undifferentiated heavy lifting. `fastapi-users` gives us full control over user data and works out-of-the-box with the starter's Postgres setup.
- **Trade-off:** We accept the maintenance burden of self-hosting auth logic in exchange for immediate velocity.

### Data Architecture

**Decision: Railway Managed PostgreSQL**
- **Rationale:** Co-locating the database with the backend service on Railway minimizes latency and simplifies networking (internal private networking).
- **Version:** PostgreSQL 16 (Current Stable).

### API & Communication Patterns

**Decision: Native FastAPI WebSockets**
- **Rationale:** We will use the standard `FastAPI.WebSocket` implementation rather than a heavy wrapper like `python-socketio`.
- **Integration:** This maps 1:1 with LangGraph's event stream, allowing us to pipe agent thought chunks directly to the frontend with minimal overhead.

### Decision Impact Analysis

**Implementation Sequence:**
1.  **init-project:** Clone starter and verify local run.
2.  **infra-setup:** Create Railway project (Postgres + Redis) and deploy backend Dockerfile.
3.  **connect-frontend:** Deploy frontend to Vercel and point `NEXT_PUBLIC_API_URL` to Railway.
4.  **websocket-spike:** Prove the WebSocket connection works across the split stack.

**Cross-Component Dependencies:**
- The **Authentication** system must share session state/tokens between the HTTP API and the WebSocket connection. We will need to ensure the JWT token is passed in the WebSocket handshake (or query param) for secure real-time connections.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
4 areas (Naming, Structure, Error Handling, Communication events).

### Naming Patterns

**The "Border Control" Pattern:**
- **Database (Postgres) & Backend (Python):** Strict `snake_case`.
    - Columns: `is_active`, `created_at`
    - Variables: `user_profile`
- **Frontend (TS/JS):** Strict `camelCase`.
    - Props: `isActive`, `createdAt`
    - Variables: `userProfile`
- **The Bridge:** Pydantic models MUST use `alias_generator=camelize` (from `pydantic.alias_generators`) and `populate_by_name=True` in `ConfigDict`. This ensures the API always speaks JSON `camelCase` to the frontend, while keeping Python `snake_case` internally.

### Structure Patterns

**Feature-Based Organization:**
- **Backend (`app/`):** Group by Domain.
    - `app/services/debate/` (Service logic)
    - `app/api/routes/debate.py` (Endpoints)
- **Frontend (`src/app/`):** Group by Feature.
    - `src/features/debate/components/`
    - `src/features/debate/hooks/`
    - `src/features/debate/types.ts`
- **Rationale:** Co-location reduces context switching for agents working on a specific vertical (e.g., "Debate Logic").

### Format Patterns

**Standard Response Envelope:**
All API endpoints (HTTP & WS) must follow this strict shape:
```json
{
  "data": { ... },       // Object or Array. Null if error.
  "error": {             // Null if success.
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }   // Optional validation errors
  },
  "meta": {              // Optional metadata
    "latency_ms": 120,
    "page": 1
  }
}
```

### Communication Patterns

**WebSocket Actions:**
Values sent over WebSockets must look like Redux Actions to simplify frontend state digestion:
```json
{
  "type": "DEBATE/ARGUMENT_RECEIVED",
  "payload": {
    "agent": "bull",
    "content": "Bitcoin is scarce..."
  },
  "timestamp": "2023-10-27T10:00:00Z"
}
```

### Enforcement Guidelines

**All AI Agents MUST:**
1.  **Never** leak `snake_case` properties to the frontend JSON.
2.  **Always** wrap WebSocket messages in the Action structure.
3.  **Always** handle errors by returning the standard error envelope, not a raw 500 string.

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
trade-app/
├── backend/ (Python/FastAPI -> Railway)
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/          # REST Endpoints (HTTP)
│   │   │   └── websockets/      # WebSocket Routes (WS)
│   │   ├── core/
│   │   │   ├── config.py        # Env vars
│   │   │   └── security.py      # Auth & JWT validation
│   │   ├── models/              # SQLAlchemy Database Models
│   │   ├── schemas/             # Pydantic Models (Snake -> Camel)
│   │   └── services/
│   │       ├── auth/            # User management
│   │       ├── market/          # Yahoo Finance/CoinGecko Integration
│   │       └── debate/          # THE CORE ENGINE
│   │           ├── engine.py    # LangGraph Workflow Definition
│   │           ├── judge.py     # LLM-as-a-Judge Logic
│   │           └── agents/
│   │               ├── bull.py
│   │               ├── bear.py
│   │               └── guardian.py
│   ├── tests/
│   ├── Dockerfile               # Production Dockerfile
│   └── pyproject.toml
│
├── frontend/ (Next.js -> Vercel)
│   ├── src/
│   │   ├── app/                 # App Router Pages
│   │   ├── components/
│   │   │   └── ui/              # Shadcn/UI (Atomic)
│   │   ├── features/            # FEATURE MODULES
│   │   │   ├── debate/
│   │   │   │   ├── components/  # ArgumentGraph.tsx, DebateStream.tsx
│   │   │   │   ├── hooks/       # useDebateSocket.ts
│   │   │   │   └── types.ts
│   │   │   ├── auth/            # LoginForm.tsx
│   │   │   └── market/          # TickerTape.tsx
│   │   ├── lib/
│   │   │   ├── api.ts           # Axios instance
│   │   │   └── socket.ts        # Native WebSocket client
│   └── next.config.mjs
│
├── docker-compose.yml           # Local Dev (DB + Redis + Backend)
└── README.md
```

### Architectural Boundaries

**API Boundaries:**
- **Frontend -> Backend:** HTTP (REST) via `NEXT_PUBLIC_API_URL`.
- **Frontend -> Backend:** WebSocket (WS) via `NEXT_PUBLIC_WS_URL`.
- **Backend -> External:** Yahoo Finance / CoinGecko APIs.
- **Backend -> LLM:** OpenAI / Anthropic APIs.

**Component Boundaries:**
- **Agents:** Pure Python classes. No knowledge of HTTP or DB. Input: State, Output: State Update.
- **Services:** handle DB transactions and business logic.
- **Routes:** handle HTTP/WS formatting and Auth.

**Data Boundaries:**
- **Frontend:** Never accesses DB directly.
- **Backend:** Owns the `postgres` and `redis` connections.

### Requirements to Structure Mapping

**Feature/Epic Mapping:**
- **Epic: Core Debate Engine**
    - Orchestrator: `backend/app/services/debate/engine.py`
    - Agents: `backend/app/services/debate/agents/`
    - API: `backend/app/api/websockets/debate.py`
    - UI: `frontend/src/features/debate/`

- **Epic: User Management**
    - Service: `backend/app/services/auth/`
    - API: `backend/app/api/routes/auth.py`
    - UI: `frontend/src/features/auth/`
    - DB: `backend/app/models/user.py`

### Integration Points

**Internal Communication:**
- **LangGraph -> Frontend:** Server sends `DEBATE/ARGUMENT_RECEIVED` action via WebSocket.
- **Frontend -> LangGraph:** Client sends `DEBATE/VOTE` action via WebSocket.

**External Integrations:**
- **Market Data:** `backend/app/services/market/` polls external APIs every 60s (cache in Redis).

**Development Workflow:**
- **Local:** `docker-compose up` runs DB + Redis + Backend. `npm run dev` runs Frontend.
- **Prod:** Git push triggers Vercel (Frontend) and Railway (Backend) builds.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
- **Split Stack (Vercel/Railway):** Valid. Vercel allows the frontend to be Edge-optimized, while Railway gives the backend the container environment needed for LangGraph and WebSockets.
- **Start Template (Vinta):** Valid. The template structure (frontend/backend directories) supports the monorepo-like development workflow we want, even if deployed separately.

**Pattern Consistency:**
- **Naming:** Pydantic `alias_generator` is the correct bridge between Python snake_case and JS camelCase.
- **Protocol:** Using `FastAPI.WebSocket` directly aligns with our requirement for low-latency streaming (FR-01).

### Requirements Coverage Validation ✅

**Epic/Feature Coverage:**
- **Core Debate Engine:** Covered by `backend/app/services/debate/` (Orchestrator + Agents) and WebSocket streaming.
- **User Management:** Covered by `fastapi-users` (Auth Service).

**Compliance Coverage (NFR-08):**
- **Safety Layer:** The `guardian.py` agent is explicitly placed in the architecture to filter output *before* it hits the WebSocket stream.

### Implementation Readiness Validation ✅

**Completeness:**
- **Structure:** Complete. All key files (engine.py, agents, routes) have specific homes.
- **Patterns:** Complete. Envelopes for HTTP and Actions for WS are defined.

### Gap Analysis Results

**Minor Gap Identified:**
- **Cross-Origin Auth:** Since the Frontend (`vercel.app`) and Backend (`railway.app`) share authentication but sit on different domains, typical cookie-based auth is cleaner but complex to configure with `SameSite` policies across providers.

**Gap Resolution:**
- **Bearer Token Pattern:** We will use JWTs sent in the WebSocket URL (`ws://api...?token=xyz`) and standard Bearer Authorization headers for HTTP.
- **Log Scrubbing:** We mandate middleware to scrub the `token` query parameter from access logs to preventing credential leakage.
- **Testability:** We mandate a `FIXED_QA_TOKEN` capability in non-prod environments to allow Playwright tests to easily connect to the WebSocket without a full login flow dance for every test case.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified

**✅ Implementation Patterns**
- [x] Naming conventions established
- [x] Communication patterns specified

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- **Type Safety:** Shared types (via generation) prevent frontend/backend drift.
- **Scalability:** Split stack allows independent scaling of the heavy AI backend and the lightweight frontend.
- **Modularity:** Feature-based frontend structure aligns well with the "Epic-based" development workflow.

### Implementation Handoff

**First Implementation Priority:**
Initialize the repository using the Vinta starter:
`git clone https://github.com/vintasoftware/nextjs-fastapi-template.git trade-app`
Then, immediately configure the split `Dockerfile` for Railway deployment.
