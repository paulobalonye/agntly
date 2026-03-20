import httpx
import respx

from agntly.client import HttpClient
from agntly.resources.agents import AgentsResource

BASE = "https://sandbox.api.agntly.io"


def _ok(data):
    return httpx.Response(200, json={"success": True, "data": data, "error": None})


def _ok_paginated(data, meta):
    return httpx.Response(200, json={"success": True, "data": data, "error": None, "meta": meta})


@respx.mock
def test_register_sends_agent_id():
    route = respx.post(f"{BASE}/v1/agents").mock(return_value=_ok({"id": "my-agent"}))
    client = HttpClient(api_key="key")
    agents = AgentsResource(client)
    result = agents.register({"agent_id": "my-agent", "name": "Test", "description": "d", "endpoint": "https://t.co", "price_usdc": "0.002", "category": "search"})
    assert result["id"] == "my-agent"
    import json; body = json.loads(route.calls[0].request.content)
    assert body["agentId"] == "my-agent"


@respx.mock
def test_list_returns_paginated():
    respx.get(f"{BASE}/v1/agents").mock(return_value=_ok_paginated([{"id": "1"}], {"total": 10, "limit": 1, "offset": 0}))
    client = HttpClient(api_key="key")
    agents = AgentsResource(client)
    result = agents.list(category="search", limit=1)
    assert len(result["data"]) == 1
    assert result["meta"]["total"] == 10


@respx.mock
def test_get_by_id():
    respx.get(f"{BASE}/v1/agents/ws-alpha").mock(return_value=_ok({"id": "ws-alpha", "name": "WebSearch"}))
    client = HttpClient(api_key="key")
    agents = AgentsResource(client)
    result = agents.get("ws-alpha")
    assert result["name"] == "WebSearch"


@respx.mock
def test_update_sends_put():
    route = respx.put(f"{BASE}/v1/agents/ws-alpha").mock(return_value=_ok({"id": "ws-alpha"}))
    client = HttpClient(api_key="key")
    agents = AgentsResource(client)
    agents.update("ws-alpha", price_usdc="0.005")
    assert route.calls[0].request.method == "PUT"


@respx.mock
def test_delist_sends_delete():
    route = respx.delete(f"{BASE}/v1/agents/ws-alpha").mock(return_value=_ok({"delisted": True}))
    client = HttpClient(api_key="key")
    agents = AgentsResource(client)
    result = agents.delist("ws-alpha")
    assert result["delisted"] is True
