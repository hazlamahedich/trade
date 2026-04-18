import pytest


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
