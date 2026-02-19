# AI Trading Debate Lab - Project Overview

## Purpose
Decision-support research platform using adversarial AI agents to analyze mock market data, debate trade ideas, and visually explain reasoning.

**NOT an auto-trading system.** Goals:
- Transparent reasoning
- Educational insight
- Customizable agent logic
- Visual explanation of decisions

## Tech Stack

### Backend
- Python 3.11+
- FastAPI 0.100+
- Pydantic 2.0+
- PostgreSQL 16+

### Frontend
- React 18+
- Next.js 14+ (App Router)
- TypeScript 5+
- React Flow (argument visualization)
- Chart.js (confidence charts)

### Testing
- Pytest + pytest-asyncio (backend)
- Vitest + React Testing Library (frontend)
- Playwright (E2E)

### State Management
- React Query (server state)
- Zustand (client state)

## Key Architecture

### Core Components (MVP)
1. **Mock Market Simulator** - Generates synthetic OHLC data, indicators, sentiment
2. **Agent Engine** - Technical Agent, Sentiment Agent (more types planned)
3. **Adversarial Debate System** - Bull vs Bear arguments, Judge scoring, Risk filtering
4. **User Customization Panel** - Rule editing without coding
5. **Visualization Engine** - Argument graphs, confidence breakdowns, timeline replay

### Data Flow
```
Mock Data Generator → Agent Engine → Debate System → Judge Agent → Risk Filter → Visualization → Final Recommendation
```

## Development Phases
- **Phase 1 (MVP):** Mock data, 2 agents, basic debate, rule editor
- **Phase 2:** Judge improvements, performance tracking, timeline replay
- **Phase 3:** Real data APIs (MT5, crypto), historical backtesting
