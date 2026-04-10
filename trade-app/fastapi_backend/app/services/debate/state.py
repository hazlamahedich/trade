from typing import Literal, TypedDict, NotRequired

RiskLevel = Literal["critical", "high", "medium", "low"]


class DebateState(TypedDict):
    asset: str
    market_context: dict
    messages: list[dict]
    current_turn: int
    max_turns: int
    current_agent: str
    status: str
    guardian_verdict: NotRequired[str]
    guardian_interrupts: NotRequired[list[dict]]
    interrupted: NotRequired[bool]
    paused: NotRequired[bool]
    pause_reason: NotRequired[str]
    pause_history: NotRequired[list[dict]]
