import httpx
import json
import respx

from agntly.client import HttpClient
from agntly.resources.tasks import TasksResource

BASE = "https://sandbox.api.agntly.io"


def _ok(data):
    return httpx.Response(200, json={"success": True, "data": data, "error": None})


@respx.mock
def test_create_reshapes_response():
    respx.post(f"{BASE}/v1/tasks").mock(return_value=_ok({
        "id": "tsk_123", "agentId": "ws-alpha", "status": "pending",
        "amount": "0.002", "completionToken": "ctk_abc",
    }))
    client = HttpClient(api_key="key")
    tasks = TasksResource(client)
    result = tasks.create(agent_id="ws-alpha", payload={"query": "test"}, budget="0.002")
    assert result["task"]["id"] == "tsk_123"
    assert result["completion_token"] == "ctk_abc"
    assert "completionToken" not in result["task"]


@respx.mock
def test_get_by_id():
    respx.get(f"{BASE}/v1/tasks/tsk_123").mock(return_value=_ok({"id": "tsk_123", "status": "complete"}))
    client = HttpClient(api_key="key")
    tasks = TasksResource(client)
    result = tasks.get("tsk_123")
    assert result["status"] == "complete"


@respx.mock
def test_complete_sends_token_and_proof():
    route = respx.post(f"{BASE}/v1/tasks/tsk_123/complete").mock(return_value=_ok({"id": "tsk_123", "status": "complete"}))
    client = HttpClient(api_key="key")
    tasks = TasksResource(client)
    tasks.complete("tsk_123", result={"answer": "done"}, completion_token="ctk_abc", proof="hash123")
    body = json.loads(route.calls[0].request.content)
    assert body["completionToken"] == "ctk_abc"
    assert body["proof"] == "hash123"


@respx.mock
def test_dispute_sends_reason():
    route = respx.post(f"{BASE}/v1/tasks/tsk_123/dispute").mock(return_value=_ok({"id": "tsk_123", "status": "disputed"}))
    client = HttpClient(api_key="key")
    tasks = TasksResource(client)
    tasks.dispute("tsk_123", reason="Bad output")
    body = json.loads(route.calls[0].request.content)
    assert body["reason"] == "Bad output"
