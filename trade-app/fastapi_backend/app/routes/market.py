import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from app.services.market import MarketDataService
from app.services.market.provider import (
    normalize_asset,
    get_yfinance_symbol,
    YFinanceProvider,
    CRYPTO_SYMBOLS,
    CRYPTO_ALIASES,
    POPULAR_STOCKS,
    POPULAR_FOREX,
)
from app.services.market.twelvedata_provider import (
    TwelveDataForexProvider,
    is_forex_asset as _is_forex_asset,
)
from app.services.market.schemas import (
    MarketData,
    MarketErrorResponse,
    MarketMeta,
)

router = APIRouter(prefix="/api/market", tags=["market"])

logger = logging.getLogger(__name__)

market_service = MarketDataService()
_yfinance_provider = YFinanceProvider()
_forex_provider: TwelveDataForexProvider | None = None


def _get_forex_provider() -> TwelveDataForexProvider | None:
    global _forex_provider
    if _forex_provider is not None:
        return _forex_provider
    from app.config import settings

    if settings.TWELVEDATA_API_KEY:
        _forex_provider = TwelveDataForexProvider(
            api_key=settings.TWELVEDATA_API_KEY,
            base_url=settings.TWELVEDATA_BASE_URL,
        )
        return _forex_provider
    return None


class StandardResponse(BaseModel):
    data: MarketData | None = None
    error: MarketErrorResponse | dict[str, Any] | None = None
    meta: MarketMeta | dict[str, Any] = {}


@router.get("/{asset}/data", response_model=StandardResponse)
async def get_market_data(asset: str, request: Request) -> StandardResponse:
    normalized = normalize_asset(asset)
    if normalized is None and not _is_forex_asset(asset):
        raise HTTPException(
            status_code=400,
            detail={
                "data": None,
                "error": {
                    "code": "INVALID_ASSET",
                    "message": f"Asset '{asset}' is not supported. Supported assets: BTC, ETH, SOL, bitcoin, ethereum, solana",
                },
                "meta": {},
            },
        )

    resolved = normalized or asset

    mock_providers_down = getattr(request.state, "mock_providers_down", False)
    mock_no_cache = getattr(request.state, "mock_no_cache", False)

    try:
        market_data, meta = await market_service.get_data(
            resolved,
            mock_providers_down=mock_providers_down,
            mock_no_cache=mock_no_cache,
        )

        if market_data is None:
            raise HTTPException(
                status_code=503,
                detail={
                    "data": None,
                    "error": {
                        "code": "MARKET_DATA_UNAVAILABLE",
                        "message": "Market data temporarily unavailable",
                    },
                    "meta": meta.model_dump(by_alias=True) if meta else {},
                },
            )

        return StandardResponse(data=market_data, error=None, meta=meta)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching market data for {asset}: {e}")
        raise HTTPException(
            status_code=503,
            detail={
                "data": None,
                "error": {
                    "code": "MARKET_DATA_UNAVAILABLE",
                    "message": "Market data temporarily unavailable",
                },
                "meta": {},
            },
        )


@router.get("/{asset}/candles")
async def get_candles(
    asset: str,
    period: str = Query("30d", regex=r"^\d+[dhmwy]$"),
    interval: str = Query("1d", regex=r"^\d+[dhmwy]$"),
):
    if _is_forex_asset(asset):
        forex_prov = _get_forex_provider()
        if forex_prov:
            outputsize = 30
            try:
                outputsize = int(period.rstrip("dhwmy"))
            except (ValueError, TypeError):
                pass
            candles = await forex_prov.fetch_ohlcv(
                asset, interval="1day", outputsize=outputsize
            )
            return {"data": candles, "error": None, "meta": {"provider": "twelvedata"}}

    symbol = get_yfinance_symbol(asset)
    if not symbol:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "INVALID_ASSET",
                    "message": f"Unsupported asset: {asset}",
                }
            },
        )
    candles = await _yfinance_provider.fetch_ohlcv_raw(
        symbol, period=period, interval=interval
    )
    return {"data": candles, "error": None, "meta": {}}


@router.get("/{asset}/technical")
async def get_technical(asset: str):
    if _is_forex_asset(asset):
        forex_prov = _get_forex_provider()
        if forex_prov:
            tech = await forex_prov.fetch_technicals(asset)
            if tech is None:
                raise HTTPException(
                    status_code=503,
                    detail={
                        "error": {
                            "code": "DATA_UNAVAILABLE",
                            "message": "Technical data unavailable",
                        }
                    },
                )
            return {"data": tech, "error": None, "meta": {"provider": "twelvedata"}}

    symbol = get_yfinance_symbol(asset)
    if not symbol:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "INVALID_ASSET",
                    "message": f"Unsupported asset: {asset}",
                }
            },
        )
    tech = await _yfinance_provider.fetch_technical_raw(symbol)
    if tech is None:
        raise HTTPException(
            status_code=503,
            detail={
                "error": {
                    "code": "DATA_UNAVAILABLE",
                    "message": "Technical data unavailable",
                }
            },
        )
    return {"data": tech, "error": None, "meta": {}}


@router.get("/assets/search")
async def search_assets(q: str = Query("", max_length=50)):
    query = q.strip().lower()
    results = []

    for alias, symbol in CRYPTO_ALIASES.items():
        if not query or query in alias or query in symbol.lower():
            results.append(
                {
                    "symbol": symbol,
                    "name": alias.capitalize(),
                    "category": "crypto",
                    "yfinance": CRYPTO_SYMBOLS.get(symbol, f"{symbol}-USD"),
                }
            )

    for ticker, name in POPULAR_STOCKS.items():
        if not query or query in ticker.lower() or query in name.lower():
            results.append(
                {
                    "symbol": ticker,
                    "name": name,
                    "category": "stocks",
                    "yfinance": ticker,
                }
            )

    for pair, name in POPULAR_FOREX.items():
        if not query or query in pair.lower() or query in name.lower():
            results.append(
                {
                    "symbol": pair,
                    "name": name,
                    "category": "forex",
                    "yfinance": f"{pair}=X",
                }
            )

    return {"data": results[:30], "error": None, "meta": {}}
