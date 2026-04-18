import uuid

import pytest

from app.models import AuditEvent, Debate


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
async def test_admin_debates_sort_by_allowlist(test_client, authenticated_admin_user):
    response = await test_client.get(
        "/api/admin/debates?sort_by=nonexistent_col",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 200
    body = response.json()
    assert "debates" in body["data"]


@pytest.mark.asyncio
async def test_admin_debates_status_filter(
    test_client, authenticated_admin_user, db_session
):
    debate_completed = Debate(
        external_id=f"ext-{uuid.uuid4()}",
        asset="BTC",
        status="completed",
    )
    debate_active = Debate(
        external_id=f"ext-{uuid.uuid4()}",
        asset="ETH",
        status="active",
    )
    db_session.add_all([debate_completed, debate_active])
    await db_session.commit()

    response = await test_client.get(
        "/api/admin/debates?status=completed",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 200
    body = response.json()
    for d in body["data"]["debates"]:
        assert d["status"] == "completed"


@pytest.mark.asyncio
async def test_admin_debates_sort_order_asc(
    test_client, authenticated_admin_user, db_session
):
    for asset in ["AAA", "BBB", "CCC"]:
        debate = Debate(
            external_id=f"ext-{uuid.uuid4()}",
            asset=asset,
            status="completed",
        )
        db_session.add(debate)
    await db_session.commit()

    response = await test_client.get(
        "/api/admin/debates?sort_by=asset&sort_order=asc",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 200
    body = response.json()
    assets = [d["asset"] for d in body["data"]["debates"]]
    assert assets == sorted(assets)


@pytest.mark.asyncio
async def test_admin_debate_detail(test_client, authenticated_admin_user, debate_eth):
    response = await test_client.get(
        f"/api/admin/debates/{debate_eth.id}/detail",
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
async def test_admin_audit_events_invalid_date_range(
    test_client, authenticated_admin_user
):
    response = await test_client.get(
        "/api/admin/audit-events?created_after=2026-01-10T00:00:00&created_before=2026-01-01T00:00:00",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_admin_audit_events_invalid_date_format(
    test_client, authenticated_admin_user
):
    response = await test_client.get(
        "/api/admin/audit-events?created_after=not-a-date&created_before=2026-01-10T00:00:00",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_admin_audit_events_filter_by_event_type(
    test_client, authenticated_admin_user, db_session, debate
):
    event = AuditEvent(
        debate_id=debate.id,
        sequence_number=1,
        event_type="GUARDIAN_ANALYSIS",
        actor="guardian",
        payload={"risk_level": "high"},
    )
    db_session.add(event)
    await db_session.commit()

    response = await test_client.get(
        "/api/admin/audit-events?event_type=GUARDIAN_ANALYSIS",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["data"]["events"]) >= 1
    for e in body["data"]["events"]:
        assert e["eventType"] == "GUARDIAN_ANALYSIS"


@pytest.mark.asyncio
async def test_admin_audit_events_filter_by_actor(
    test_client, authenticated_admin_user, db_session, debate
):
    event = AuditEvent(
        debate_id=debate.id,
        sequence_number=1,
        event_type="SANITIZATION",
        actor="bull",
        payload={},
    )
    db_session.add(event)
    await db_session.commit()

    response = await test_client.get(
        "/api/admin/audit-events?actor=bull",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["data"]["events"]) >= 1
    for e in body["data"]["events"]:
        assert e["actor"] == "bull"


@pytest.mark.asyncio
async def test_admin_debate_audit_events_list(
    test_client, authenticated_admin_user, debate
):
    response = await test_client.get(
        f"/api/admin/debates/{debate.id}/audit-events",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert "events" in body["data"]


@pytest.mark.asyncio
async def test_admin_debates_debate_scoped_audit_events(
    test_client, authenticated_admin_user, db_session, debate_eth
):
    for seq, etype in [(1, "DEBATE_STARTED"), (2, "SANITIZATION")]:
        event = AuditEvent(
            debate_id=debate_eth.id,
            sequence_number=seq,
            event_type=etype,
            actor="system" if seq == 1 else "bull",
            payload={},
        )
        db_session.add(event)
    await db_session.commit()

    response = await test_client.get(
        f"/api/admin/debates/{debate_eth.id}/audit-events?event_type=SANITIZATION",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["data"]["events"]) == 1
    assert body["data"]["events"][0]["eventType"] == "SANITIZATION"
