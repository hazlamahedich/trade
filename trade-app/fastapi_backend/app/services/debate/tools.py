import json
import logging

from langchain_core.tools import tool

from app.services.market.twelvedata_provider import (
    TwelveDataForexProvider,
    is_forex_asset,
    normalize_forex_symbol,
)
from app.config import settings

logger = logging.getLogger(__name__)

_provider: TwelveDataForexProvider | None = None


def _get_provider() -> TwelveDataForexProvider | None:
    global _provider
    if _provider is not None:
        return _provider
    if settings.TWELVEDATA_API_KEY:
        _provider = TwelveDataForexProvider(
            api_key=settings.TWELVEDATA_API_KEY,
            base_url=settings.TWELVEDATA_BASE_URL,
        )
        return _provider
    return None


def get_forex_tools() -> list:
    if not settings.TWELVEDATA_API_KEY:
        return []
    return [_forex_get_price, _forex_get_technicals, _forex_get_ohlcv]


@tool
async def _forex_get_price(asset: str) -> str:
    """Get the current price for a forex pair. Use when you need the latest price mid-debate.

    Args:
        asset: Forex pair symbol (e.g., "EURUSD", "GBP/USD", "USD/JPY")
    """
    provider = _get_provider()
    if not provider:
        return json.dumps({"error": "Forex data provider not configured"})
    if not is_forex_asset(asset):
        return json.dumps({"error": f"{asset} is not a forex pair"})
    result = await provider.fetch_price(asset)
    if result is None:
        return json.dumps({"error": f"Could not fetch price for {asset}"})
    return json.dumps({"asset": asset, "price": result["price"]})


@tool
async def _forex_get_technicals(asset: str) -> str:
    """Get technical indicators (RSI, MACD, SMA, Bollinger Bands, ATR) for a forex pair.
    Use when you need fresh technical data to support or refute an argument.

    Args:
        asset: Forex pair symbol (e.g., "EURUSD", "GBP/USD", "USD/JPY")
    """
    provider = _get_provider()
    if not provider:
        return json.dumps({"error": "Forex data provider not configured"})
    if not is_forex_asset(asset):
        return json.dumps({"error": f"{asset} is not a forex pair"})
    result = await provider.fetch_technicals(asset)
    if result is None:
        return json.dumps({"error": f"Could not fetch technicals for {asset}"})
    return json.dumps(result)


@tool
async def _forex_get_ohlcv(
    asset: str,
    interval: str = "1day",
    outputsize: int = 10,
) -> str:
    """Get OHLCV candle data for a forex pair. Use when you need recent price action patterns.

    Args:
        asset: Forex pair symbol (e.g., "EURUSD", "GBP/USD", "USD/JPY")
        interval: Time interval (1min, 5min, 15min, 30min, 1h, 1day). Default: 1day
        outputsize: Number of candles to return. Default: 10
    """
    provider = _get_provider()
    if not provider:
        return json.dumps({"error": "Forex data provider not configured"})
    if not is_forex_asset(asset):
        return json.dumps({"error": f"{asset} is not a forex pair"})
    result = await provider.fetch_ohlcv(asset, interval=interval, outputsize=outputsize)
    if not result:
        return json.dumps({"error": f"Could not fetch OHLCV for {asset}"})
    symbol = normalize_forex_symbol(asset) or asset
    return json.dumps({"symbol": symbol, "interval": interval, "candles": result})


async def close_tools() -> None:
    global _provider
    if _provider:
        await _provider.close()
        _provider = None
