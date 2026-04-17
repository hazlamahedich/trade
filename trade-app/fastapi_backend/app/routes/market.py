import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from app.services.market import MarketDataService
from app.services.market.provider import normalize_asset, YFinanceProvider
from app.services.market.schemas import (
    MarketData,
    MarketErrorResponse,
    MarketMeta,
)

router = APIRouter(prefix="/api/market", tags=["market"])

logger = logging.getLogger(__name__)

market_service = MarketDataService()
_yfinance_provider = YFinanceProvider()


class StandardResponse(BaseModel):
    data: MarketData | None = None
    error: MarketErrorResponse | dict[str, Any] | None = None
    meta: MarketMeta | dict[str, Any] = {}


@router.get("/{asset}/data", response_model=StandardResponse)
async def get_market_data(asset: str, request: Request) -> StandardResponse:
    normalized = normalize_asset(asset)
    if normalized is None:
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

    mock_providers_down = getattr(request.state, "mock_providers_down", False)
    mock_no_cache = getattr(request.state, "mock_no_cache", False)

    try:
        market_data, meta = await market_service.get_data(
            normalized,
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
    normalized = normalize_asset(asset)
    if normalized is None:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "INVALID_ASSET",
                    "message": f"Unsupported asset: {asset}",
                }
            },
        )
    candles = await _yfinance_provider.fetch_ohlcv(
        normalized, period=period, interval=interval
    )
    return {"data": candles, "error": None, "meta": {}}


@router.get("/{asset}/technical")
async def get_technical(asset: str):
    normalized = normalize_asset(asset)
    if normalized is None:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "INVALID_ASSET",
                    "message": f"Unsupported asset: {asset}",
                }
            },
        )
    tech = await _yfinance_provider.fetch_technical(normalized)
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
