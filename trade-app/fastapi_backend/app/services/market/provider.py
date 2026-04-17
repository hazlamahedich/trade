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
    "XRP": "XRP-USD",
    "ADA": "ADA-USD",
    "DOGE": "DOGE-USD",
    "DOT": "DOT-USD",
    "AVAX": "AVAX-USD",
    "MATIC": "MATIC-USD",
    "LINK": "LINK-USD",
    "LTC": "LTC-USD",
}

CRYPTO_ALIASES: dict[str, str] = {
    "bitcoin": "BTC",
    "btc": "BTC",
    "ethereum": "ETH",
    "eth": "ETH",
    "solana": "SOL",
    "sol": "SOL",
    "xrp": "XRP",
    "ada": "ADA",
    "doge": "DOGE",
    "dot": "DOT",
    "avax": "AVAX",
    "matic": "MATIC",
    "link": "LINK",
    "ltc": "LTC",
}

POPULAR_STOCKS: dict[str, str] = {
    "AAPL": "Apple",
    "MSFT": "Microsoft",
    "GOOGL": "Alphabet",
    "AMZN": "Amazon",
    "TSLA": "Tesla",
    "NVDA": "NVIDIA",
    "META": "Meta",
    "NFLX": "Netflix",
    "AMD": "AMD",
    "JPM": "JPMorgan",
    "V": "Visa",
    "DIS": "Disney",
    "BA": "Boeing",
    "INTC": "Intel",
    "PYPL": "PayPal",
}

POPULAR_FOREX: dict[str, str] = {
    "EURUSD": "EUR/USD",
    "GBPUSD": "GBP/USD",
    "USDJPY": "USD/JPY",
    "AUDUSD": "AUD/USD",
    "USDCAD": "USD/CAD",
    "USDCHF": "USD/CHF",
    "NZDUSD": "NZD/USD",
    "EURGBP": "EUR/GBP",
    "EURJPY": "EUR/JPY",
    "GBPJPY": "GBP/JPY",
}


def normalize_asset(asset: str) -> str | None:
    mapping = CRYPTO_ALIASES
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

    @staticmethod
    def _price_decimals(price: float) -> int:
        if price < 1:
            return 6
        if price < 10:
            return 5
        if price < 100:
            return 4
        if price < 1000:
            return 3
        return 2

    def _fetch_ohlcv_sync(
        self, symbol: str, period: str = "30d", interval: str = "1d"
    ) -> list[dict[str, Any]]:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period=period, interval=interval)
            if hist.empty:
                return []
            sample_price = float(hist["Close"].iloc[0])
            dp = self._price_decimals(sample_price)
            rows = []
            for idx, row in hist.iterrows():
                utc_date = idx.tz_convert("UTC").normalize()
                utc_day = int(utc_date.timestamp())
                rows.append(
                    {
                        "time": utc_day,
                        "open": round(float(row["Open"]), dp),
                        "high": round(float(row["High"]), dp),
                        "low": round(float(row["Low"]), dp),
                        "close": round(float(row["Close"]), dp),
                        "volume": int(row["Volume"]),
                    }
                )
            return rows
        except Exception as e:
            logger.error(f"yfinance _fetch_ohlcv_sync error for {symbol}: {e}")
            return []

    async def fetch_ohlcv(
        self, asset: str, period: str = "30d", interval: str = "1d"
    ) -> list[dict[str, Any]]:
        symbol = get_yfinance_symbol(asset)
        if not symbol:
            return []
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._fetch_ohlcv_sync, symbol, period, interval
        )

    def _fetch_technical_sync(self, symbol: str) -> dict[str, Any] | None:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info
            hist = ticker.history(period="90d", interval="1d")
            if hist.empty or len(hist) < 5:
                return None

            closes = hist["Close"].values
            highs = hist["High"].values
            lows = hist["Low"].values
            volumes = hist["Volume"].values

            current_price = float(closes[-1])

            recent_high = (
                float(max(highs[-30:])) if len(highs) >= 30 else float(max(highs))
            )
            recent_low = float(min(lows[-30:])) if len(lows) >= 30 else float(min(lows))

            sma_20 = float(closes[-20:].mean()) if len(closes) >= 20 else None
            sma_50 = float(closes[-50:].mean()) if len(closes) >= 50 else None

            avg_vol_20 = (
                float(volumes[-20:].mean())
                if len(volumes) >= 20
                else float(volumes.mean())
            )
            current_vol = float(volumes[-1])
            vol_ratio = round(current_vol / avg_vol_20, 2) if avg_vol_20 > 0 else 1.0

            if len(closes) >= 14:
                deltas = []
                for i in range(1, min(15, len(closes))):
                    deltas.append(float(closes[-i]) - float(closes[-i - 1]))
                gains = [d for d in deltas if d > 0]
                losses = [-d for d in deltas if d < 0]
                avg_gain = sum(gains) / 14 if gains else 0
                avg_loss = sum(losses) / 14 if losses else 0.001
                rs = avg_gain / avg_loss
                rsi_14 = round(100 - (100 / (1 + rs)), 1)
            else:
                rsi_14 = None

            change_24h = (
                round(
                    ((current_price - float(closes[-2])) / float(closes[-2])) * 100, 2
                )
                if len(closes) >= 2
                else None
            )
            change_7d = (
                round(
                    ((current_price - float(closes[-7])) / float(closes[-7])) * 100, 2
                )
                if len(closes) >= 7
                else None
            )

            fib_range = recent_high - recent_low
            support_1 = round(recent_high - fib_range * 0.236, 2)
            support_2 = round(recent_high - fib_range * 0.382, 2)
            resistance_1 = round(recent_low + fib_range * 0.618, 2)
            resistance_2 = round(recent_low + fib_range * 0.786, 2)

            return {
                "currentPrice": current_price,
                "periodHigh": round(recent_high, 2),
                "periodLow": round(recent_low, 2),
                "sma20": round(sma_20, 2) if sma_20 else None,
                "sma50": round(sma_50, 2) if sma_50 else None,
                "rsi14": rsi_14,
                "volumeRatio": vol_ratio,
                "change24h": change_24h,
                "change7d": change_7d,
                "supportLevels": [support_2, support_1],
                "resistanceLevels": [resistance_1, resistance_2],
                "marketCap": getattr(info, "market_cap", None),
                "fiftyDayAverage": getattr(info, "fifty_day_average", None),
                "twoHundredDayAverage": getattr(info, "two_hundred_day_average", None),
            }
        except Exception as e:
            logger.error(f"yfinance _fetch_technical_sync error for {symbol}: {e}")
            return None

    async def fetch_technical(self, asset: str) -> dict[str, Any] | None:
        symbol = get_yfinance_symbol(asset)
        if not symbol:
            return None
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._fetch_technical_sync, symbol)

    async def fetch_ohlcv_raw(
        self, symbol: str, period: str = "30d", interval: str = "1d"
    ) -> list[dict[str, Any]]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._fetch_ohlcv_sync, symbol, period, interval
        )

    async def fetch_technical_raw(self, symbol: str) -> dict[str, Any] | None:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._fetch_technical_sync, symbol)

    async def close(self) -> None:
        pass
