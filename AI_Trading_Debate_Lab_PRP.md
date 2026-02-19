# AI Trading Debate Lab -- Product Requirements Plan (PRP)

Version: 1.0\
Date: 2026-02-18

------------------------------------------------------------------------

# 1. Executive Summary

AI Trading Debate Lab is a decision-support research platform that uses
adversarial AI agents to analyze mock market data, debate trade ideas,
and visually explain how conclusions were reached.

This is NOT an auto-trading system.

The goal is: - Transparent reasoning - Educational insight -
Customizable agent logic - Visual explanation of decisions

------------------------------------------------------------------------

# 2. Objectives

## Primary Objectives

-   Provide AI-generated trade recommendations (decision support only)
-   Allow users to customize agent logic without coding
-   Visually display how agents reasoned
-   Simulate market data using mock data (no external APIs required)

## Secondary Objectives

-   Track agent performance over time
-   Enable scenario-based market simulations
-   Prepare architecture for future API integration

------------------------------------------------------------------------

# 3. Core Features (MVP)

## 3.1 Mock Market Simulator

### Description

Generates synthetic market data to simulate real trading environments.

### Requirements

-   Generate OHLC price candles
-   Simulate volume
-   Simulate indicators (RSI, EMA50, EMA200, MACD, ADX)
-   Simulate sentiment scores
-   Support market regimes:
    -   Bull Market
    -   Bear Market
    -   Sideways Market

------------------------------------------------------------------------

## 3.2 Agent Engine

### Agent Types (MVP)

1.  Technical Agent
2.  Sentiment Agent

Each agent must: - Analyze market data - Apply rule-based logic - Output
bias (Bullish / Bearish / Neutral) - Output confidence score - Provide
list of evidence used

### Example Agent Output

``` json
{
  "bias": "Bullish",
  "confidence": 0.67,
  "evidence": [
    "RSI oversold",
    "EMA50 above EMA200"
  ]
}
```

------------------------------------------------------------------------

## 3.3 Adversarial Debate System

### Description

Bullish and Bearish arguments must be generated and compared.

### Process

1.  Technical Agent generates bias
2.  Sentiment Agent challenges or supports
3.  Judge Agent scores arguments
4.  Risk Filter checks risk conditions
5.  Final recommendation generated

### Output Example

-   Bull Strength: 0.72
-   Bear Strength: 0.61
-   Final Bias: Buy
-   Confidence: 63%

------------------------------------------------------------------------

## 3.4 User Customization Panel

Users must be able to:

-   Add new rules
-   Modify rule weights
-   Change indicator thresholds
-   Adjust scoring threshold

### Rule Structure

``` json
{
  "indicator": "RSI",
  "condition": "< 30",
  "weight": 2
}
```

No coding required.

------------------------------------------------------------------------

## 3.5 Visualization Engine

### Required Visualizations

1.  Argument Graph
    -   Nodes = Evidence
    -   Green = Bullish
    -   Red = Bearish
    -   Edges show support or contradiction
2.  Confidence Breakdown
    -   Technical Score
    -   Sentiment Score
    -   Risk Score
    -   Final Score
3.  Decision Timeline Replay
    -   Show how signals evolved over time

------------------------------------------------------------------------

# 4. System Architecture

## Logical Flow

Mock Data Generator\
↓\
Agent Engine\
↓\
Debate System\
↓\
Judge Agent\
↓\
Risk Filter\
↓\
Visualization Layer\
↓\
Final Recommendation

------------------------------------------------------------------------

# 5. Technical Stack (MVP)

## Backend

-   Python
-   FastAPI
-   Pydantic
-   PostgreSQL (optional for storing rules)

## Frontend

-   React
-   React Flow (argument visualization)
-   Chart.js (confidence charts)

------------------------------------------------------------------------

# 6. Data Model Design

## Market Data Object

``` json
{
  "time": "2026-02-18 10:00",
  "open": 1.1050,
  "high": 1.1070,
  "low": 1.1035,
  "close": 1.1062,
  "volume": 15432,
  "indicators": {
    "rsi": 28,
    "ema50": 1.1040,
    "ema200": 1.1030,
    "macd": 0.002,
    "adx": 18
  },
  "sentiment": {
    "news_score": -0.3,
    "retail_positioning": 72
  }
}
```

------------------------------------------------------------------------

# 7. Risk Management (Decision Support Only)

Risk Agent must: - Detect high volatility scenarios - Flag weak ADX
trends - Warn if confidence \< threshold - Provide risk rating (Low /
Moderate / High)

No automatic trade execution allowed.

------------------------------------------------------------------------

# 8. Performance Tracking

Each agent should track:

-   Win rate (based on simulated forward candles)
-   Sharpe ratio (simulated)
-   Max drawdown (simulated)

Judge agent may adjust weights based on performance.

------------------------------------------------------------------------

# 9. Future Expansion

-   Replace mock data with real APIs
-   Add Macro Agent
-   Add Reinforcement Learning judge
-   Export strategies to MT5 / Pine Script
-   Multi-user system
-   Agent marketplace

------------------------------------------------------------------------

# 10. Development Phases

## Phase 1 -- Mock MVP

-   Mock data generator
-   Technical Agent
-   Sentiment Agent
-   Basic debate scoring
-   Score visualization
-   Rule editor

## Phase 2 -- Enhanced Intelligence

-   Judge scoring improvements
-   Performance tracking
-   Timeline replay
-   Advanced visual argument graph

## Phase 3 -- Real Data Integration

-   MT5 connection
-   Crypto API integration
-   Historical backtesting

------------------------------------------------------------------------

# 11. Success Metrics

-   Transparent reasoning displayed
-   Custom rule editing works
-   Stable mock simulation
-   Clear final recommendation
-   Visual graph accurately reflects debate logic

------------------------------------------------------------------------

# Conclusion

AI Trading Debate Lab will be a transparent, educational, and
customizable research platform that simulates multi-agent trading
debates using mock data. The architecture ensures clean separation
between data source and agent logic, enabling easy transition to real
data in future phases.
