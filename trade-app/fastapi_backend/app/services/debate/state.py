from typing import TypedDict


class DebateState(TypedDict):
    asset: str
    market_context: dict
    messages: list[dict]
    current_turn: int
    max_turns: int
    current_agent: str
    status: str
