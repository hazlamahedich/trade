import uuid

import pytest
from unittest.mock import AsyncMock, patch

from app.models import HallucinationFlag


@pytest.mark.asyncio
async def test_admin_hallucination_flag_creation(
    test_client, authenticated_admin_user, db_session, debate_eth
):
    response = await test_client.post(
        f"/api/admin/debates/{debate_eth.id}/hallucination-flags",
        json={
            "turn": 2,
            "agent": "bull",
            "message_snippet": "guaranteed returns",
            "notes": "suspicious claim",
        },
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["status"] == "pending"
    assert body["data"]["agent"] == "bull"


@pytest.mark.asyncio
async def test_admin_hallucination_flag_404_for_missing_debate(
    test_client, authenticated_admin_user
):
    fake_id = str(uuid.uuid4())
    response = await test_client.post(
        f"/api/admin/debates/{fake_id}/hallucination-flags",
        json={
            "turn": 1,
            "agent": "bull",
            "message_snippet": "test",
        },
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_admin_hallucination_flag_status_update(
    test_client, authenticated_admin_user, db_session, debate_with_flag
):
    _, flag = debate_with_flag

    with patch("app.services.audit.writer.get_audit_writer") as mock_get:
        mock_writer = AsyncMock()
        mock_get.return_value = mock_writer
        response = await test_client.patch(
            f"/api/admin/hallucination-flags/{flag.id}",
            json={"status": "confirmed", "notes": "verified hallucination"},
            headers=authenticated_admin_user["headers"],
        )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["status"] == "confirmed"


@pytest.mark.asyncio
async def test_admin_hallucination_flag_confirmed_emits_audit_event(
    test_client, authenticated_admin_user, db_session, debate_with_flag
):
    _, flag = debate_with_flag

    with patch("app.services.audit.writer.get_audit_writer") as mock_get:
        mock_writer = AsyncMock()
        mock_get.return_value = mock_writer
        response = await test_client.patch(
            f"/api/admin/hallucination-flags/{flag.id}",
            json={"status": "confirmed"},
            headers=authenticated_admin_user["headers"],
        )

    assert response.status_code == 200
    mock_writer.write.assert_called_once()
    call_args = mock_writer.write.call_args[0][0]
    assert call_args["event_type"] == "HALLUCINATION_FLAGGED"
    assert call_args["actor"] == "system"
    assert call_args["payload"]["flag_id"] == str(flag.id)


@pytest.mark.asyncio
async def test_admin_hallucination_flag_empty_body_returns_400(
    test_client, authenticated_admin_user, debate_with_flag
):
    _, flag = debate_with_flag

    response = await test_client.patch(
        f"/api/admin/hallucination-flags/{flag.id}",
        json={},
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_admin_hallucination_flag_no_dismissed_to_confirmed(
    test_client, authenticated_admin_user, debate_with_dismissed_flag
):
    _, flag = debate_with_dismissed_flag

    response = await test_client.patch(
        f"/api/admin/hallucination-flags/{flag.id}",
        json={"status": "confirmed"},
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_admin_hallucination_flag_dismissed_to_pending(
    test_client, authenticated_admin_user, db_session, debate_with_dismissed_flag
):
    _, flag = debate_with_dismissed_flag

    response = await test_client.patch(
        f"/api/admin/hallucination-flags/{flag.id}",
        json={"status": "pending", "notes": "reopened after review"},
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["status"] == "pending"
    assert body["data"]["notes"] == "reopened after review"


@pytest.mark.asyncio
async def test_admin_hallucination_flags_list_with_filter(
    test_client, authenticated_admin_user, db_session, debate
):
    flag_pending = HallucinationFlag(
        debate_id=debate.id,
        turn=1,
        agent="bull",
        message_snippet="test1",
        status="pending",
    )
    flag_confirmed = HallucinationFlag(
        debate_id=debate.id,
        turn=2,
        agent="bear",
        message_snippet="test2",
        status="confirmed",
    )
    db_session.add_all([flag_pending, flag_confirmed])
    await db_session.commit()

    response = await test_client.get(
        "/api/admin/hallucination-flags?status=pending",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 200
    body = response.json()
    assert "flags" in body["data"]
    for f in body["data"]["flags"]:
        assert f["status"] == "pending"
