import uuid
import logging
import time
import asyncio

from app.database import async_session_maker
from app.services.market import MarketDataService
from app.services.market.provider import YFinanceProvider
from app.services.debate.engine import create_debate_graph
from app.services.debate.schemas import DebateResponse
from app.services.debate.exceptions import StaleDataError
from app.services.debate.repository import DebateRepository
from app.services.debate.archival import archive_with_retry
from app.services.debate.agents.trading_analyst import generate_trading_analysis
from app.config import settings

logger = logging.getLogger(__name__)


class DebateService:
    def __init__(self, redis_url: str | None = None):
        settings.validate_llm_config()
        self.market_service = MarketDataService(redis_url or settings.REDIS_URL)
        self.yfinance = YFinanceProvider()
        self.graph = create_debate_graph()

    async def close(self) -> None:
        await self.market_service.close()
        await self.yfinance.close()

    async def create_debate(self, asset: str) -> DebateResponse:
        market_context = await self.market_service.get_context(asset)

        if market_context is None:
            raise StaleDataError(f"No market data available for {asset}")

        if market_context.is_stale:
            logger.warning(f"Stale data detected for {asset}, blocking debate")
            raise StaleDataError("Cannot start debate with stale data")

        debate_id = f"deb_{uuid.uuid4().hex[:8]}"

        async with async_session_maker() as session:
            repo = DebateRepository(session)
            await repo.save_debate(
                external_id=debate_id,
                asset=asset,
                status="running",
                current_turn=0,
                max_turns=settings.debate_max_turns,
            )
            logger.info(f"Created debate row {debate_id} in database")

        initial_state = {
            "asset": asset,
            "market_context": market_context.model_dump(),
            "messages": [],
            "current_turn": 0,
            "max_turns": settings.debate_max_turns,
            "current_agent": "bull",
            "status": "running",
        }

        asyncio.create_task(self._run_debate(debate_id, asset, initial_state))

        return DebateResponse(
            debate_id=debate_id,
            asset=asset,
            status="running",
            messages=[],
            current_turn=0,
            max_turns=settings.debate_max_turns,
        )

    async def _run_debate(
        self,
        debate_id: str,
        asset: str,
        initial_state: dict,
    ) -> None:
        start_time = time.time()
        try:
            print(f"[DEBATE] Starting debate {debate_id} for {asset}", flush=True)
            config = {"configurable": {"thread_id": debate_id}}
            result = await self.graph.ainvoke(initial_state, config)
            print(
                f"[DEBATE] Graph completed for {debate_id}, {len(result['messages'])} messages",
                flush=True,
            )

            trading_analysis = None
            try:
                tech_data = await self.yfinance.fetch_technical(asset)
                debate_messages = [
                    {"role": m["role"], "content": m["content"]}
                    for m in result["messages"]
                    if m["role"] in ("bull", "bear")
                ]
                trading_analysis = await generate_trading_analysis(
                    asset=asset,
                    messages=debate_messages,
                    technical_data=tech_data,
                )
                logger.info(
                    f"Trading analysis generated for {debate_id}: {trading_analysis.get('direction', 'unknown')}"
                )
            except Exception as e:
                logger.error(f"Trading analysis failed for {debate_id}: {e}")
                print(
                    f"[DEBATE-ERR] Trading analysis failed for {debate_id}: {e}",
                    flush=True,
                )

            archive_state = {
                "messages": [
                    {"role": m["role"], "content": m["content"]}
                    for m in result["messages"]
                ],
                "current_turn": result["current_turn"],
                "guardian_verdict": result.get("guardian_verdict"),
                "guardian_interrupts": result.get("guardian_interrupts", []),
                "trading_analysis": trading_analysis,
            }
            archived = await archive_with_retry(debate_id, archive_state)
            if not archived:
                logger.error(f"Failed to archive debate {debate_id} after completion")
                print(f"[DEBATE-ERR] Archive failed for {debate_id}", flush=True)

            latency_ms = int((time.time() - start_time) * 1000)
            print(
                f"[DEBATE] {debate_id} completed in {latency_ms}ms, ta={'YES' if trading_analysis else 'NO'}",
                flush=True,
            )
        except Exception as e:
            logger.error(f"Debate {debate_id} failed: {e}", exc_info=True)
            print(f"[DEBATE-ERR] Debate {debate_id} failed: {e}", flush=True)
            try:
                async with async_session_maker() as session:
                    repo = DebateRepository(session)
                    debate = await repo.get_by_external_id(debate_id)
                    if debate and debate.status == "running":
                        debate.status = "failed"
                        await session.commit()
                        logger.info(f"Debate {debate_id} marked as failed")
            except Exception as cleanup_err:
                logger.error(
                    f"Failed to mark debate {debate_id} as failed: {cleanup_err}"
                )
