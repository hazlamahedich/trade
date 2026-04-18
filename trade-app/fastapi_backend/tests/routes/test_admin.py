import uuid
import pytest
from unittest.mock import AsyncMock, patch

from app.models import Debate, HallucinationFlag


@pytest.mark.asyncio
async def test_non_admin_gets_403_on_admin_endpoints(test_client, authenticated_user):
    response = await test_client.get(
        "/api/admin/me", headers=authenticated_user["headers"]
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_unauthenticated_gets_401_on_admin_endpoints(test_client):
    response = await test_client.get("/api/admin/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_me_returns_200(test_client, authenticated_admin_user):
    response = await test_client.get(
        "/api/admin/me", headers=authenticated_admin_user["headers"]
    )
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["email"] == "admin@trade.dev"
    assert body["data"]["isSuperuser"] is True


@pytest.mark.asyncio
async def test_admin_debates_list(test_client, authenticated_admin_user, db_session):
    debate = Debate(
        external_id=f"ext-{uuid.uuid4()}",
        asset="BTC",
        status="completed",
    )
    db_session.add(debate)
    await db_session.commit()

    response = await test_client.get(
        "/api/admin/debates", headers=authenticated_admin_user["headers"]
    )
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert "debates" in body["data"]


@pytest.mark.asyncio
async def test_admin_audit_events_invalid_date_range(
    test_client, authenticated_admin_user
):
    response = await test_client.get(
        "/api/admin/audit-events?created_after=2026-01-10T00:00:00&created_before=2026-01-01T00:00:00",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_admin_hallucination_flag_creation(
    test_client, authenticated_admin_user, db_session
):
    debate = Debate(
        external_id=f"ext-{uuid.uuid4()}",
        asset="ETH",
        status="completed",
    )
    db_session.add(debate)
    await db_session.commit()

    response = await test_client.post(
        f"/api/admin/debates/{debate.id}/hallucination-flags",
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
    test_client, authenticated_admin_user, db_session
):
    debate = Debate(
        external_id=f"ext-{uuid.uuid4()}",
        asset="BTC",
        status="completed",
    )
    db_session.add(debate)
    await db_session.commit()

    flag = HallucinationFlag(
        debate_id=debate.id,
        turn=1,
        agent="bull",
        message_snippet="test",
        status="pending",
    )
    db_session.add(flag)
    await db_session.commit()
    await db_session.refresh(flag)

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
async def test_admin_responses_use_envelope_format(
    test_client, authenticated_admin_user
):
    response = await test_client.get(
        "/api/admin/debates", headers=authenticated_admin_user["headers"]
    )
    body = response.json()
    assert "data" in body
    assert "error" in body
    assert "meta" in body


@pytest.mark.asyncio
async def test_admin_debates_pagination_beyond_data(
    test_client, authenticated_admin_user
):
    response = await test_client.get(
        "/api/admin/debates?page=999&page_size=20",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["debates"] == []


@pytest.mark.asyncio
async def test_admin_debate_audit_events_list(
    test_client, authenticated_admin_user, db_session
):
    debate = Debate(
        external_id=f"ext-{uuid.uuid4()}",
        asset="BTC",
        status="completed",
    )
    db_session.add(debate)
    await db_session.commit()

    response = await test_client.get(
        f"/api/admin/debates/{debate.id}/audit-events",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert "events" in body["data"]


@pytest.mark.asyncio
async def test_admin_debate_detail(test_client, authenticated_admin_user, db_session):
    debate = Debate(
        external_id=f"ext-{uuid.uuid4()}",
        asset="ETH",
        status="completed",
    )
    db_session.add(debate)
    await db_session.commit()

    response = await test_client.get(
        f"/api/admin/debates/{debate.id}/detail",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert "debate" in body["data"]
    assert body["data"]["debate"]["asset"] == "ETH"


@pytest.mark.asyncio
async def test_admin_debate_detail_404_for_missing(
    test_client, authenticated_admin_user
):
    fake_id = str(uuid.uuid4())
    response = await test_client.get(
        f"/api/admin/debates/{fake_id}/detail",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_admin_dlq_list(test_client, authenticated_admin_user):
    response = await test_client.get(
        "/api/admin/audit/dlq",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert "meta" in body


@pytest.mark.asyncio
async def test_admin_dlq_replay_not_found(test_client, authenticated_admin_user):
    fake_id = str(uuid.uuid4())
    response = await test_client.post(
        f"/api/admin/audit/dlq/{fake_id}/replay",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_admin_dlq_replay_409_max_retries(
    test_client, authenticated_admin_user, db_session
):
    from app.models import AuditDLQ

    dlq = AuditDLQ(
        original_event={
            "debate_id": str(uuid.uuid4()),
            "event_type": "TEST",
            "actor": "system",
            "payload": {},
        },
        error_message="permanent fail",
        retry_count=3,
    )
    db_session.add(dlq)
    await db_session.commit()

    response = await test_client.post(
        f"/api/admin/audit/dlq/{dlq.id}/replay",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_admin_hallucination_flag_confirmed_emits_audit_event(
    test_client, authenticated_admin_user, db_session
):
    debate = Debate(
        external_id=f"ext-{uuid.uuid4()}",
        asset="BTC",
        status="completed",
    )
    db_session.add(debate)
    await db_session.commit()

    flag = HallucinationFlag(
        debate_id=debate.id,
        turn=1,
        agent="bull",
        message_snippet="guaranteed 100% returns",
        status="pending",
    )
    db_session.add(flag)
    await db_session.commit()
    await db_session.refresh(flag)

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
    test_client, authenticated_admin_user, db_session
):
    debate = Debate(
        external_id=f"ext-{uuid.uuid4()}",
        asset="BTC",
        status="completed",
    )
    db_session.add(debate)
    await db_session.commit()

    flag = HallucinationFlag(
        debate_id=debate.id,
        turn=1,
        agent="bull",
        message_snippet="test",
        status="pending",
    )
    db_session.add(flag)
    await db_session.commit()
    await db_session.refresh(flag)

    response = await test_client.patch(
        f"/api/admin/hallucination-flags/{flag.id}",
        json={},
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_admin_hallucination_flag_no_dismissed_to_confirmed(
    test_client, authenticated_admin_user, db_session
):
    debate = Debate(
        external_id=f"ext-{uuid.uuid4()}",
        asset="BTC",
        status="completed",
    )
    db_session.add(debate)
    await db_session.commit()

    flag = HallucinationFlag(
        debate_id=debate.id,
        turn=1,
        agent="bull",
        message_snippet="test",
        status="dismissed",
    )
    db_session.add(flag)
    await db_session.commit()
    await db_session.refresh(flag)

    response = await test_client.patch(
        f"/api/admin/hallucination-flags/{flag.id}",
        json={"status": "confirmed"},
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 400
