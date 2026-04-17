import asyncio
import logging
import time
from abc import ABC, abstractmethod
from typing import Any

import yfinance as yf

from app.services.market.schemas import NewsItem

logger = logging.getLogger(__name__)

CRYPTO_SYMBOLS: dict[str, str] = {
    "BTC": "BTC-USD",
    "ETH": "ETH-USD",
    "SOL": "SOL-USD",
}

SUPPORTED_ASSETS: set[str] = {"BTC", "ETH", "SOL", "bitcoin", "ethereum", "solana"}


def normalize_asset(asset: str) -> str | None:
    """Normalize crypto asset name to uppercase symbol. Returns None if not a known crypto."""
    mapping = {
        "bitcoin": "BTC",
        "ethereum": "ETH",
        "solana": "SOL",
        "btc": "BTC",
        "eth": "ETH",
        "sol": "SOL",
    }
    return mapping.get(asset.lower())


def get_yfinance_symbol(asset: str) -> str | None:
    """Convert asset name to yfinance ticker symbol.

    Crypto:  BTC / bitcoin  → BTC-USD
    Forex:   EURUSD         → EURUSD=X
    Stocks:  AAPL           → AAPL
    """
    normalized = normalize_asset(asset)
    if normalized:
        return CRYPTO_SYMBOLS.get(normalized)

    upper = asset.upper()
    if not upper:
        return None

    # Six-letter all-alpha strings are treated as forex pairs
    if len(upper) == 6 and upper.isalpha():
        return f"{upper}=X"

    return upper


class DataProvider(ABC):
    @abstractmethod
    async def fetch_price(self, asset: str) -> dict[str, Any] | None:
        pass

    @abstractmethod
    async def fetch_news(self, asset: str) -> list[NewsItem]:
        pass

    @abstractmethod
    def get_name(self) -> str:
        pass


class YFinanceProvider(DataProvider):
    def get_name(self) -> str:
        return "yfinance"

    def _fetch_price_sync(self, symbol: str) -> dict[str, Any] | None:
        try:
            price = yf.Ticker(symbol).fast_info.last_price
            if price is None:
                return None
            return {"price": float(price), "last_updated": time.time()}
        except Exception as e:
            logger.error(f"yfinance fetch_price error for {symbol}: {e}")
            return None

    async def fetch_price(self, asset: str) -> dict[str, Any] | None:
        symbol = get_yfinance_symbol(asset)
        if not symbol:
            return None
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._fetch_price_sync, symbol)

    async def fetch_news(self, asset: str) -> list[NewsItem]:
        return []

    async def close(self) -> None:
        pass
