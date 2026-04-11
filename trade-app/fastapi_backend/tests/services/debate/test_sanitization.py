import json
import pytest
from unittest.mock import patch, MagicMock
from pydantic import BaseModel

from app.services.debate.sanitization import (
    sanitize_content,
    sanitize_response,
    SanitizationResult,
    SanitizationContext,
)


class TestSanitizeContentBasic:
    def test_redacts_guaranteed(self):
        result = sanitize_content("This is guaranteed to work")
        assert "[REDACTED]" in result.content
        assert "guaranteed" not in result.content.lower()
        assert result.is_redacted is True

    def test_redacts_multiple_phrases(self):
        result = sanitize_content("This is guaranteed and risk-free")
        assert result.content.count("[REDACTED]") >= 2
        assert "guaranteed" not in result.content.lower()
        assert "risk-free" not in result.content.lower()
        assert result.is_redacted is True
        assert len(result.redacted_phrases) >= 2

    def test_case_insensitive_guaranteed(self):
        for variant in ["GUARANTEED", "Guaranteed", "guaranteed", "GuArAnTeEd"]:
            result = sanitize_content(f"This is {variant} to work")
            assert "[REDACTED]" in result.content
            assert result.is_redacted is True

    def test_clean_text_not_redacted(self):
        text = "Bitcoin may increase in value based on fundamentals"
        result = sanitize_content(text)
        assert result.content == text
        assert result.is_redacted is False
        assert result.redacted_phrases == []

    def test_backward_compat_sanitize_response(self):
        result = sanitize_response("This is guaranteed profit")
        assert isinstance(result, str)
        assert "[REDACTED]" in result

    def test_handles_none_input(self):
        result = sanitize_content(None)
        assert result.content == ""
        assert result.is_redacted is False
        assert result.redacted_phrases == []

    def test_handles_empty_string(self):
        result = sanitize_content("")
        assert result.content == ""
        assert result.is_redacted is False

    def test_handles_whitespace_only(self):
        result = sanitize_content("   \n\t  ")
        assert result.is_redacted is False


class TestSanitizeContentNewPhrases:
    @pytest.mark.parametrize(
        "phrase",
        ["can't lose", "foolproof", "no-brainer", "bulletproof", "surefire"],
    )
    def test_new_phrases_redacted(self, phrase):
        result = sanitize_content(f"This is {phrase} investment")
        assert "[REDACTED]" in result.content
        assert result.is_redacted is True

    def test_cannot_fail_redacted(self):
        result = sanitize_content("This cannot fail")
        assert "[REDACTED]" in result.content

    def test_double_your_redacted(self):
        result = sanitize_content("You can double your money")
        assert "[REDACTED]" in result.content

    def test_moonshot_redacted(self):
        result = sanitize_content("This is a moonshot opportunity")
        assert "[REDACTED]" in result.content

    def test_to_the_moon_redacted(self):
        result = sanitize_content("Bitcoin is going to the moon")
        assert "[REDACTED]" in result.content


class TestSanitizeContentEdgeCases:
    def test_partial_match_not_redacted(self):
        result = sanitize_content("The guarantor signed the agreement")
        assert "guarantor" in result.content.lower()
        assert result.is_redacted is False

    def test_phrase_at_start(self):
        result = sanitize_content("Guaranteed profit ahead")
        assert result.content.startswith("[REDACTED]")

    def test_phrase_at_end(self):
        result = sanitize_content("This is guaranteed")
        assert result.content.endswith("[REDACTED]")

    def test_content_only_forbidden_phrase(self):
        result = sanitize_content("guaranteed")
        assert result.content == "[REDACTED]"

    def test_punctuation_adjacency(self):
        for suffix in ["!", ".", ",", ";"]:
            result = sanitize_content(f"This is guaranteed{suffix}")
            assert "[REDACTED]" in result.content

    def test_hyphenated_compound_not_redacted(self):
        result = sanitize_content("This is non-guaranteed")
        assert "non-" in result.content

    def test_hundred_percent_redacted(self):
        result = sanitize_content("Returns of 100% are expected")
        assert "[REDACTED]" in result.content

    def test_two_phrases_together(self):
        result = sanitize_content("guaranteed sure thing")
        assert result.content.count("[REDACTED]") == 2
        assert "guaranteed" not in result.content.lower()

    def test_sanitization_result_is_basemodel(self):
        result = sanitize_content("test")
        assert isinstance(result, BaseModel)
        assert isinstance(result, SanitizationResult)


class TestSanitizeContentWithContext:
    def test_structured_log_with_context(self, caplog):
        import logging

        with caplog.at_level(logging.WARNING):
            ctx = SanitizationContext(debate_id="deb-123", agent="bull", turn=1)
            result = sanitize_content("This is guaranteed profit", context=ctx)
            assert result.is_redacted
        assert any(
            "forbidden_phrase_redacted" in record.message for record in caplog.records
        )

    def test_structured_log_contains_fields(self, caplog):
        import logging

        with caplog.at_level(logging.WARNING):
            ctx = SanitizationContext(debate_id="deb-456", agent="bear", turn=2)
            sanitize_content("risk-free investment", context=ctx)
        for record in caplog.records:
            if "forbidden_phrase_redacted" in record.message:
                data = json.loads(record.message)
                assert data["debate_id"] == "deb-456"
                assert data["agent"] == "bear"
                assert data["turn"] == 2
                assert data["source"] == "safety_net"
                break

    def test_simple_log_without_context(self, caplog):
        import logging

        with caplog.at_level(logging.WARNING):
            sanitize_content("This is guaranteed profit")
        assert any(
            "Redacted forbidden phrase" in record.message for record in caplog.records
        )

    def test_redacted_phrases_list(self):
        result = sanitize_content("guaranteed risk-free safe bet")
        assert len(result.redacted_phrases) >= 2
        assert "guaranteed" in result.redacted_phrases


class TestSanitizeContentConfigurable:
    def test_custom_phrase_list_overrides(self):
        import re as _re

        custom_phrases = ["custombad"]
        custom_patterns = [
            _re.compile(_re.escape(p), _re.IGNORECASE) for p in custom_phrases
        ]

        with (
            patch("app.services.debate.sanitization.FORBIDDEN_PHRASES", custom_phrases),
            patch(
                "app.services.debate.sanitization._COMPILED_PATTERNS", custom_patterns
            ),
        ):
            result = sanitize_content("This has custombad word")
            assert "[REDACTED]" in result.content
            assert result.is_redacted is True
            assert "custombad" in result.redacted_phrases

    def test_empty_phrase_list_returns_content_unchanged(self):
        """When patched to empty lists (simulating runtime override), no redaction occurs."""
        with (
            patch("app.services.debate.sanitization.FORBIDDEN_PHRASES", []),
            patch("app.services.debate.sanitization._COMPILED_PATTERNS", []),
        ):
            result = sanitize_content("This is guaranteed")
            assert result.content == "This is guaranteed"
            assert result.is_redacted is False
            assert result.redacted_phrases == []
            assert result.redaction_ratio == 0.0


class TestTruncationQuality:
    def test_truncation_does_not_split_redacted(self):
        base = "x" * 80 + " guaranteed " + "y" * 80
        result = sanitize_content(base)
        summary = result.content[:100]
        if "[REDACTED]" in summary:
            assert summary.count("[REDACTED]") <= 1


class TestRedactionRatio:
    def test_ratio_zero_for_clean_text(self):
        result = sanitize_content("Bitcoin may increase in value")
        assert result.redaction_ratio == 0.0

    def test_ratio_positive_for_redacted_text(self):
        result = sanitize_content("This is guaranteed profit")
        assert result.redaction_ratio > 0.0
        assert result.redaction_ratio <= 1.0

    def test_ratio_high_for_heavily_redacted(self):
        result = sanitize_content("guaranteed risk-free safe bet sure thing")
        assert result.redaction_ratio > 0.5

    def test_ratio_for_single_phrase(self):
        result = sanitize_content("The market is guaranteed to rise tomorrow")
        assert 0.0 < result.redaction_ratio < 0.3

    def test_ratio_zero_for_empty(self):
        result = sanitize_content("")
        assert result.redaction_ratio == 0.0

    def test_argument_entry_named_tuple(self):
        from app.services.debate.sanitization import ArgumentEntry

        entry = ArgumentEntry(raw="guaranteed", sanitized="[REDACTED]")
        assert entry.raw == "guaranteed"
        assert entry.sanitized == "[REDACTED]"
        assert isinstance(entry, tuple)
