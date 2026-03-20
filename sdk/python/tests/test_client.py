import httpx
import pytest
import respx

from agntly.client import HttpClient
from agntly.errors import AgntlyError

BASE = "https://sandbox.api.agntly.io"


def test_empty_api_key_raises():
    with pytest.raises(AgntlyError, match="api_key is required"):
        HttpClient(api_key="")


@respx.mock
def test_auth_header_sent():
    route = respx.get(f"{BASE}/v1/test").mock(
        return_value=httpx.Response(200, json={"success": True, "data": {"ok": True}, "error": None})
    )
    client = HttpClient(api_key="ag_test_key")
    client.get("/v1/test")
    assert route.called
    assert route.calls[0].request.headers["authorization"] == "Bearer ag_test_key"


@respx.mock
def test_strips_envelope_returns_data():
    respx.get(f"{BASE}/v1/agents/1").mock(
        return_value=httpx.Response(200, json={"success": True, "data": {"id": "1", "name": "Test"}, "error": None})
    )
    client = HttpClient(api_key="key")
    result = client.get("/v1/agents/1")
    assert result == {"id": "1", "name": "Test"}


@respx.mock
def test_get_paginated_returns_full_body():
    respx.get(f"{BASE}/v1/agents").mock(
        return_value=httpx.Response(200, json={
            "success": True, "data": [{"id": "1"}], "error": None,
            "meta": {"total": 5, "limit": 1, "offset": 0},
        })
    )
    client = HttpClient(api_key="key")
    result = client.get_paginated("/v1/agents")
    assert len(result["data"]) == 1
    assert result["meta"]["total"] == 5


@respx.mock
def test_query_params_sent():
    route = respx.get(f"{BASE}/v1/agents").mock(
        return_value=httpx.Response(200, json={"success": True, "data": [], "error": None})
    )
    client = HttpClient(api_key="key")
    client.get("/v1/agents", params={"category": "search", "limit": 10, "skip": None})
    url = str(route.calls[0].request.url)
    assert "category=search" in url
    assert "limit=10" in url
    assert "skip" not in url


@respx.mock
def test_error_response_raises_agntly_error():
    respx.get(f"{BASE}/v1/bad").mock(
        return_value=httpx.Response(400, json={"success": False, "data": None, "error": "Wallet not found"})
    )
    client = HttpClient(api_key="key")
    with pytest.raises(AgntlyError, match="Wallet not found") as exc_info:
        client.get("/v1/bad")
    assert exc_info.value.status == 400


@respx.mock
def test_non_json_error_handled():
    respx.get(f"{BASE}/v1/bad").mock(
        return_value=httpx.Response(502, text="<html>Bad Gateway</html>")
    )
    client = HttpClient(api_key="key")
    with pytest.raises(AgntlyError) as exc_info:
        client.get("/v1/bad")
    assert exc_info.value.status == 502
    assert "502" in str(exc_info.value)


@respx.mock
def test_network_error_wrapped():
    respx.get(f"{BASE}/v1/test").mock(side_effect=httpx.ConnectError("Connection refused"))
    client = HttpClient(api_key="key")
    with pytest.raises(AgntlyError) as exc_info:
        client.get("/v1/test")
    assert exc_info.value.status == 0


@respx.mock
def test_post_sends_json_body():
    route = respx.post(f"{BASE}/v1/tasks").mock(
        return_value=httpx.Response(200, json={"success": True, "data": {"id": "1"}, "error": None})
    )
    client = HttpClient(api_key="key")
    client.post("/v1/tasks", json={"agentId": "a1"})
    body = route.calls[0].request.content.decode()
    assert '"agentId"' in body


@respx.mock
def test_default_base_url():
    route = respx.get(f"{BASE}/v1/test").mock(
        return_value=httpx.Response(200, json={"success": True, "data": {}, "error": None})
    )
    client = HttpClient(api_key="key")
    client.get("/v1/test")
    assert route.called
