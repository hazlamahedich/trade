import pytest
from unittest.mock import MagicMock, patch, AsyncMock

from app.services.debate.agents.bull import BullAgent
from app.services.debate.agents.bear import BearAgent
from app.services.debate.sanitization import sanitize_response


class TestBullAgent:
    @pytest.fixture
    def bull_agent(self, debate_state):
        with patch("app.services.debate.agents.bull.ChatOpenAI") as _mock_llm_class:
            with patch(
                "app.services.debate.agents.bull.ChatPromptTemplate"
            ) as mock_prompt_class:
                response_mock = MagicMock()
                response_mock.content = "Test argument"

                chain_mock = MagicMock()
                chain_mock.ainvoke = AsyncMock(return_value=response_mock)

                mock_prompt = MagicMock()
                mock_prompt.__or__ = MagicMock(return_value=chain_mock)
                mock_prompt_class.from_template.return_value = mock_prompt

                agent = BullAgent()
                yield agent

    @pytest.mark.asyncio
    async def test_bull_generates_argument(self, bull_agent, debate_state):
        result = await bull_agent.generate(debate_state)

        assert "messages" in result
        assert len(result["messages"]) == 1
        assert result["messages"][0]["role"] == "bull"
        assert result["messages"][0]["content"] == "Test argument"
        assert result["current_turn"] == 1
        assert result["current_agent"] == "bear"

    @pytest.mark.asyncio
    async def test_bull_references_bear_argument(self, debate_state):
        with patch("app.services.debate.agents.bull.ChatOpenAI"):
            with patch(
                "app.services.debate.agents.bull.ChatPromptTemplate"
            ) as mock_prompt_class:
                response_mock = MagicMock()
                response_mock.content = "Test argument"

                chain_mock = MagicMock()
                chain_mock.ainvoke = AsyncMock(return_value=response_mock)

                mock_prompt = MagicMock()
                mock_prompt.__or__ = MagicMock(return_value=chain_mock)
                mock_prompt_class.from_template.return_value = mock_prompt

                debate_state["messages"] = [
                    {"role": "bear", "content": "Previous bear argument"}
                ]
                bull_agent = BullAgent()

                result = await bull_agent.generate(debate_state)

                assert result["messages"][-1]["role"] == "bull"

    def test_sanitize_response_redacts_forbidden_phrases(self):
        content = "This is a guaranteed profit opportunity with zero risk-free"
        result = sanitize_response(content)

        assert "guaranteed" not in result.lower()
        assert "risk-free" not in result.lower()
        assert "[REDACTED]" in result


class TestBearAgent:
    @pytest.fixture
    def bear_agent(self, debate_state):
        with patch("app.services.debate.agents.bear.ChatOpenAI"):
            with patch(
                "app.services.debate.agents.bear.ChatPromptTemplate"
            ) as mock_prompt_class:
                response_mock = MagicMock()
                response_mock.content = "Test argument"

                chain_mock = MagicMock()
                chain_mock.ainvoke = AsyncMock(return_value=response_mock)

                mock_prompt = MagicMock()
                mock_prompt.__or__ = MagicMock(return_value=chain_mock)
                mock_prompt_class.from_template.return_value = mock_prompt

                agent = BearAgent()
                yield agent

    @pytest.mark.asyncio
    async def test_bear_generates_argument(self, bear_agent, debate_state):
        debate_state["messages"] = [{"role": "bull", "content": "Bitcoin is going up!"}]

        result = await bear_agent.generate(debate_state)

        assert "messages" in result
        assert len(result["messages"]) == 2
        assert result["messages"][-1]["role"] == "bear"
        assert result["messages"][-1]["content"] == "Test argument"
        assert result["current_turn"] == 1
        assert result["current_agent"] == "bull"

    @pytest.mark.asyncio
    async def test_bear_references_bull_argument(self, bear_agent, debate_state):
        debate_state["messages"] = [{"role": "bull", "content": "Bull says buy now!"}]

        result = await bear_agent.generate(debate_state)

        assert result["messages"][-1]["role"] == "bear"


class TestSanitizeResponse:
    def test_sanitize_response_redacts_guaranteed(self):
        content = "This is guaranteed to work"
        result = sanitize_response(content)
        assert "guaranteed" not in result.lower()

    def test_sanitize_response_redacts_risk_free(self):
        content = "This is a risk-free investment"
        result = sanitize_response(content)
        assert "risk-free" not in result.lower()

    def test_sanitize_response_redacts_safe_bet(self):
        content = "It's a safe bet"
        result = sanitize_response(content)
        assert "safe bet" not in result.lower()

    def test_sanitize_response_redacts_sure_thing(self):
        content = "This is a sure thing"
        result = sanitize_response(content)
        assert "sure thing" not in result.lower()

    def test_sanitize_response_preserves_normal_content(self):
        content = "Bitcoin may increase in value based on fundamentals"
        result = sanitize_response(content)
        assert result == content


class TestSanitizeResponseCaseInsensitivity:
    """P1 Gap Test: R-3.4 - Forbidden phrase case-insensitivity"""

    def test_sanitize_redacts_uppercase_guaranteed(self):
        content = "This is GUARANTEED to work"
        result = sanitize_response(content)
        assert "GUARANTEED" not in result
        assert "[REDACTED]" in result

    def test_sanitize_redacts_mixed_case_risk_free(self):
        content = "This is a Risk-Free investment"
        result = sanitize_response(content)
        assert "Risk-Free" not in result
        assert "[REDACTED]" in result

    def test_sanitize_redacts_uppercase_safe_bet(self):
        content = "It's a SAFE BET"
        result = sanitize_response(content)
        assert "SAFE BET" not in result
        assert "[REDACTED]" in result

    def test_sanitize_redacts_all_caps_sure_thing(self):
        content = "THIS IS A SURE THING"
        result = sanitize_response(content)
        assert "SURE THING" not in result
        assert "[REDACTED]" in result

    def test_sanitize_redacts_camel_case_guaranteed(self):
        content = "This is GuArAnTeEd profit"
        result = sanitize_response(content)
        assert "GuArAnTeEd" not in result
        assert "[REDACTED]" in result
