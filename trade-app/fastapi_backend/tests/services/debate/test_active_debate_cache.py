import pytest
import json
from unittest.mock import AsyncMock, patch

from app.services.debate.cache import (
    get_cached_active_debate,
    set_cached_active_debate,
    ACTIVE_DEBATE_CACHE_KEY,
    ACTIVE_DEBATE_CACHE_TTL,
    NULL_SENTINEL,
    _get_redis,
)


@pytest.fixture
def mock_redis():
    redis_mock = AsyncMock()
    redis_mock.get = AsyncMock(return_value=None)
    redis_mock.set = AsyncMock(return_value=True)
    return redis_mock


@pytest.fixture(autouse=True)
def reset_redis_pool():
    import app.services.debate.cache as cache_mod

    cache_mod._redis_pool = None
    yield
    cache_mod._redis_pool = None


@pytest.mark.asyncio
async def test_get_cached_active_debate_returns_none_when_empty(mock_redis):
    with patch("app.services.debate.cache._get_redis", return_value=mock_redis):
        result = await get_cached_active_debate()
        assert result is None
        mock_redis.get.assert_called_once_with(ACTIVE_DEBATE_CACHE_KEY)


@pytest.mark.asyncio
async def test_get_cached_active_debate_returns_parsed_json(mock_redis):
    cached_data = {"id": "deb_1", "asset": "btc", "status": "active"}
    mock_redis.get = AsyncMock(return_value=json.dumps(cached_data))

    with patch("app.services.debate.cache._get_redis", return_value=mock_redis):
        result = await get_cached_active_debate()
        assert result == cached_data


@pytest.mark.asyncio
async def test_get_cached_active_debate_returns_null_sentinel(mock_redis):
    mock_redis.get = AsyncMock(return_value=NULL_SENTINEL)

    with patch("app.services.debate.cache._get_redis", return_value=mock_redis):
        result = await get_cached_active_debate()
        assert result == NULL_SENTINEL


@pytest.mark.asyncio
async def test_get_cached_active_debate_handles_redis_error(mock_redis):
    mock_redis.get = AsyncMock(side_effect=Exception("Connection refused"))

    with patch("app.services.debate.cache._get_redis", return_value=mock_redis):
        result = await get_cached_active_debate()
        assert result is None


@pytest.mark.asyncio
async def test_set_cached_active_debate_stores_json_with_ttl(mock_redis):
    data = {"id": "deb_2", "asset": "eth", "status": "active"}

    with patch("app.services.debate.cache._get_redis", return_value=mock_redis):
        await set_cached_active_debate(data)

        mock_redis.set.assert_called_once_with(
            ACTIVE_DEBATE_CACHE_KEY,
            json.dumps(data),
            ex=ACTIVE_DEBATE_CACHE_TTL,
        )


@pytest.mark.asyncio
async def test_set_cached_active_debate_stores_null_sentinel(mock_redis):
    with patch("app.services.debate.cache._get_redis", return_value=mock_redis):
        await set_cached_active_debate(None)

        mock_redis.set.assert_called_once_with(
            ACTIVE_DEBATE_CACHE_KEY,
            NULL_SENTINEL,
            ex=ACTIVE_DEBATE_CACHE_TTL,
        )


@pytest.mark.asyncio
async def test_set_cached_active_debate_handles_redis_error(mock_redis):
    mock_redis.set = AsyncMock(side_effect=Exception("Write failed"))

    with patch("app.services.debate.cache._get_redis", return_value=mock_redis):
        await set_cached_active_debate({"id": "x"})


@pytest.mark.asyncio
async def test_get_redis_creates_singleton():

    with patch("app.services.debate.cache.aioredis.from_url") as mock_from_url:
        mock_client = AsyncMock()
        mock_from_url.return_value = mock_client

        r1 = await _get_redis()
        r2 = await _get_redis()

        assert r1 is r2
        mock_from_url.assert_called_once()


def test_cache_key_constant():
    assert ACTIVE_DEBATE_CACHE_KEY == "landing:active_debate"


def test_cache_ttl_is_between_10_and_15():
    assert 10 <= ACTIVE_DEBATE_CACHE_TTL <= 15


def test_null_sentinel_value():
    assert NULL_SENTINEL == "__null_sentinel__"
