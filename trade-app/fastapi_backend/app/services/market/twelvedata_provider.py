import logging
import time
from datetime import datetime
from typing import Any

import httpx

from app.services.market.schemas import NewsItem
from app.services.market.provider import DataProvider, POPULAR_FOREX

logger = logging.getLogger(__name__)

FOREX_ALIASES: dict[str, str] = {
    name.lower(): code for code, name in POPULAR_FOREX.items()
}


def is_forex_asset(asset: str) -> bool:
    upper = asset.upper()
    if upper in POPULAR_FOREX:
        return True
    if len(upper) == 6 and upper.isalpha():
        return True
    if asset.lower() in FOREX_ALIASES:
        return True
    return False


def normalize_forex_symbol(asset: str) -> str | None:
    upper = asset.upper()
    if upper in POPULAR_FOREX:
        return POPULAR_FOREX[upper]
    if len(upper) == 6 and upper.isalpha():
        return f"{upper[:3]}/{upper[3:]}"
    alias = FOREX_ALIASES.get(asset.lower())
    if alias and alias in POPULAR_FOREX:
        return POPULAR_FOREX[alias]
    return None


class TwelveDataForexProvider(DataProvider):
    def __init__(self, api_key: str, base_url: str = "https://api.twelvedata.com"):
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._client: httpx.AsyncClient | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=15.0)
        return self._client

    def get_name(self) -> str:
        return "twelvedata"

    async def fetch_price(self, asset: str) -> dict[str, Any] | None:
        symbol = normalize_forex_symbol(asset)
        if not symbol:
            return None
        try:
            client = self._get_client()
            resp = await client.get(
                f"{self._base_url}/price",
                params={"symbol": symbol, "apikey": self._api_key},
            )
            resp.raise_for_status()
            data = resp.json()
            price = data.get("price")
            if price is None:
                return None
            return {"price": float(price), "last_updated": time.time()}
        except Exception as e:
            logger.error(f"TwelveData fetch_price error for {asset}: {e}")
            return None

    async def fetch_news(self, asset: str) -> list[NewsItem]:
        return []

    async def fetch_ohlcv(
        self,
        asset: str,
        interval: str = "1day",
        outputsize: int = 30,
    ) -> list[dict[str, Any]]:
        symbol = normalize_forex_symbol(asset)
        if not symbol:
            return []
        try:
            client = self._get_client()
            resp = await client.get(
                f"{self._base_url}/time_series",
                params={
                    "symbol": symbol,
                    "interval": interval,
                    "outputsize": outputsize,
                    "apikey": self._api_key,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            values = data.get("values", [])
            rows = []
            for v in values:
                rows.append(
                    {
                        "time": int(datetime.fromisoformat(v["datetime"]).timestamp()),
                        "open": float(v["open"]),
                        "high": float(v["high"]),
                        "low": float(v["low"]),
                        "close": float(v["close"]),
                        "volume": None,
                    }
                )
            return list(reversed(rows))
        except Exception as e:
            logger.error(f"TwelveData fetch_ohlcv error for {asset}: {e}")
            return []

    async def fetch_technicals(self, asset: str) -> dict[str, Any] | None:
        symbol = normalize_forex_symbol(asset)
        if not symbol:
            return None

        client = self._get_client()
        params_base = {
            "symbol": symbol,
            "interval": "1day",
            "outputsize": 100,
            "apikey": self._api_key,
        }

        results: dict[str, Any] = {}

        try:
            rsi_resp = await client.get(
                f"{self._base_url}/rsi",
                params={**params_base, "time_period": 14},
            )
            rsi_resp.raise_for_status()
            rsi_data = rsi_resp.json()
            rsi_values = rsi_data.get("values", [])
            if rsi_values:
                results["rsi_14"] = float(rsi_values[0].get("rsi", 0))
        except Exception as e:
            logger.warning(f"TwelveData RSI fetch failed for {asset}: {e}")

        try:
            sma_resp = await client.get(
                f"{self._base_url}/sma",
                params={**params_base, "time_period": 20},
            )
            sma_resp.raise_for_status()
            sma_data = sma_resp.json()
            sma_values = sma_data.get("values", [])
            if sma_values:
                results["sma_20"] = float(sma_values[0].get("sma", 0))
        except Exception as e:
            logger.warning(f"TwelveData SMA20 fetch failed for {asset}: {e}")

        try:
            sma50_resp = await client.get(
                f"{self._base_url}/sma",
                params={**params_base, "time_period": 50},
            )
            sma50_resp.raise_for_status()
            sma50_data = sma50_resp.json()
            sma50_values = sma50_data.get("values", [])
            if sma50_values:
                results["sma_50"] = float(sma50_values[0].get("sma", 0))
        except Exception as e:
            logger.warning(f"TwelveData SMA50 fetch failed for {asset}: {e}")

        try:
            macd_resp = await client.get(
                f"{self._base_url}/macd",
                params=params_base,
            )
            macd_resp.raise_for_status()
            macd_data = macd_resp.json()
            macd_values = macd_data.get("values", [])
            if macd_values:
                results["macd"] = {
                    "macd": float(macd_values[0].get("macd", 0)),
                    "signal": float(macd_values[0].get("macd_signal", 0)),
                    "histogram": float(macd_values[0].get("macd_hist", 0)),
                }
        except Exception as e:
            logger.warning(f"TwelveData MACD fetch failed for {asset}: {e}")

        try:
            bb_resp = await client.get(
                f"{self._base_url}/bbands",
                params=params_base,
            )
            bb_resp.raise_for_status()
            bb_data = bb_resp.json()
            bb_values = bb_data.get("values", [])
            if bb_values:
                results["bollinger_bands"] = {
                    "upper": float(bb_values[0].get("upper_band", 0)),
                    "middle": float(bb_values[0].get("middle_band", 0)),
                    "lower": float(bb_values[0].get("lower_band", 0)),
                }
        except Exception as e:
            logger.warning(f"TwelveData BBANDS fetch failed for {asset}: {e}")

        try:
            atr_resp = await client.get(
                f"{self._base_url}/atr",
                params={**params_base, "time_period": 14},
            )
            atr_resp.raise_for_status()
            atr_data = atr_resp.json()
            atr_values = atr_data.get("values", [])
            if atr_values:
                results["atr_14"] = float(atr_values[0].get("atr", 0))
        except Exception as e:
            logger.warning(f"TwelveData ATR fetch failed for {asset}: {e}")

        try:
            ts_resp = await client.get(
                f"{self._base_url}/time_series",
                params={**params_base, "outputsize": 8},
            )
            ts_resp.raise_for_status()
            ts_data = ts_resp.json()
            ts_values = ts_data.get("values", [])
            if len(ts_values) >= 2:
                prev_close = float(ts_values[1].get("close", 0))
                curr_close = float(ts_values[0].get("close", 0))
                if prev_close > 0:
                    results["change_24h"] = round(
                        ((curr_close - prev_close) / prev_close) * 100, 2
                    )
            if len(ts_values) >= 8:
                week_ago_close = float(ts_values[7].get("close", 0))
                curr_close = float(ts_values[0].get("close", 0))
                if week_ago_close > 0:
                    results["change_7d"] = round(
                        ((curr_close - week_ago_close) / week_ago_close) * 100, 2
                    )
        except Exception as e:
            logger.warning(
                f"TwelveData time_series (changes) fetch failed for {asset}: {e}"
            )

        return results if results else None

    async def fetch_forex_meta(self, asset: str) -> dict[str, Any] | None:
        symbol = normalize_forex_symbol(asset)
        if not symbol:
            return None
        parts = symbol.split("/")
        if len(parts) != 2:
            return None
        base_curr, quote_curr = parts

        pair_display = f"{base_curr}/{quote_curr}"

        pip_value = None
        if quote_curr == "JPY":
            pip_value = 0.01
        elif quote_curr in ("USD", "EUR", "GBP", "AUD", "CAD", "CHF", "NZD"):
            pip_value = 0.0001

        return {
            "pair": pair_display,
            "base_currency": base_curr,
            "quote_currency": quote_curr,
            "spread": None,
            "pip_value": pip_value,
            "lot_size": 100000,
        }

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
