import uuid
import logging
import time

from app.services.market import MarketDataService
from app.services.debate.engine import create_debate_graph
from app.services.debate.schemas import DebateResponse, DebateMessage
from app.services.debate.exceptions import StaleDataError
from app.config import settings

logger = logging.getLogger(__name__)


class DebateService:
    def __init__(self, redis_url: str | None = None):
        settings.validate_llm_config()
        self.market_service = MarketDataService(redis_url or settings.REDIS_URL)
        self.graph = create_debate_graph()

    async def close(self) -> None:
        await self.market_service.close()

    async def start_debate(self, asset: str) -> DebateResponse:
        start_time = time.time()

        market_context = await self.market_service.get_context(asset)

        if market_context is None:
            raise StaleDataError(f"No market data available for {asset}")

        if market_context.is_stale:
            logger.warning(f"Stale data detected for {asset}, blocking debate")
            raise StaleDataError("Cannot start debate with stale data")

        debate_id = f"deb_{uuid.uuid4().hex[:8]}"

        initial_state = {
            "asset": asset,
            "market_context": market_context.model_dump(),
            "messages": [],
            "current_turn": 0,
            "max_turns": settings.debate_max_turns,
            "current_agent": "bull",
            "status": "running",
        }

        logger.info(f"Starting debate {debate_id} for {asset}")
        config = {"configurable": {"thread_id": debate_id}}
        result = await self.graph.ainvoke(initial_state, config)

        messages = [
            DebateMessage(role=msg["role"], content=msg["content"])
            for msg in result["messages"]
        ]

        latency_ms = int((time.time() - start_time) * 1000)
        logger.info(f"Debate {debate_id} completed in {latency_ms}ms")

        return DebateResponse(
            debate_id=debate_id,
            asset=asset,
            status="completed",
            messages=messages,
            current_turn=result["current_turn"],
            max_turns=result["max_turns"],
        )
