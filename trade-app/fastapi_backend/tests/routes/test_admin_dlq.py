import pytest
from unittest.mock import AsyncMock, patch


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
    import uuid

    fake_id = str(uuid.uuid4())
    response = await test_client.post(
        f"/api/admin/audit/dlq/{fake_id}/replay",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_admin_dlq_replay_409_max_retries(
    test_client, authenticated_admin_user, dlq_maxed_entry
):
    response = await test_client.post(
        f"/api/admin/audit/dlq/{dlq_maxed_entry.id}/replay",
        headers=authenticated_admin_user["headers"],
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_admin_dlq_replay_with_force(
    test_client, authenticated_admin_user, db_session, dlq_maxed_entry
):
    with patch("app.services.audit.dlq.DirectAuditWriter") as MockWriter:
        mock_instance = AsyncMock()
        MockWriter.return_value = mock_instance
        response = await test_client.post(
            f"/api/admin/audit/dlq/{dlq_maxed_entry.id}/replay?force=true",
            headers=authenticated_admin_user["headers"],
        )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["replayed"] is True
