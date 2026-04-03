from __future__ import annotations

from typing import Any
from urllib.parse import quote

from ..client import HttpClient, AsyncHttpClient
from .. import analytics


def _build_create_body(agent_id: str, payload: dict, budget: str, timeout_ms: int | None) -> dict[str, Any]:
    body: dict[str, Any] = {"agentId": agent_id, "payload": payload, "budget": budget}
    if timeout_ms is not None:
        body["timeoutMs"] = timeout_ms
    return body


def _reshape_create_response(raw: dict[str, Any]) -> dict[str, Any]:
    """Reshape flat server response into {task, completion_token} without mutation."""
    completion_token = raw.get("completionToken")
    task = {k: v for k, v in raw.items() if k != "completionToken"}
    return {"task": task, "completion_token": completion_token}


def _build_complete_body(result: dict, completion_token: str, proof: str | None) -> dict[str, Any]:
    body: dict[str, Any] = {"result": result, "completionToken": completion_token}
    if proof is not None:
        body["proof"] = proof
    return body


def _build_dispute_body(reason: str, evidence: str | None) -> dict[str, Any]:
    body: dict[str, Any] = {"reason": reason}
    if evidence is not None:
        body["evidence"] = evidence
    return body


class TasksResource:
    def __init__(self, client: HttpClient):
        self._client = client

    def create(self, *, agent_id: str, payload: dict, budget: str, timeout_ms: int | None = None) -> dict[str, Any]:
        raw = self._client.post("/v1/tasks", json=_build_create_body(agent_id, payload, budget, timeout_ms))
        result = _reshape_create_response(raw)
        analytics.capture(
            distinct_id=agent_id,
            event="task_created",
            properties={"agent_id": agent_id, "budget": budget, "has_timeout": timeout_ms is not None, "task_id": raw.get("id")},
        )
        return result

    def get(self, task_id: str) -> dict[str, Any]:
        return self._client.get(f"/v1/tasks/{quote(task_id)}")

    def complete(self, task_id: str, *, result: dict, completion_token: str, proof: str | None = None) -> dict[str, Any]:
        response = self._client.post(f"/v1/tasks/{quote(task_id)}/complete", json=_build_complete_body(result, completion_token, proof))
        analytics.capture(distinct_id=task_id, event="task_completed", properties={"task_id": task_id, "has_proof": proof is not None})
        return response

    def dispute(self, task_id: str, *, reason: str, evidence: str | None = None) -> dict[str, Any]:
        response = self._client.post(f"/v1/tasks/{quote(task_id)}/dispute", json=_build_dispute_body(reason, evidence))
        analytics.capture(distinct_id=task_id, event="task_disputed", properties={"task_id": task_id, "has_evidence": evidence is not None})
        return response


class AsyncTasksResource:
    def __init__(self, client: AsyncHttpClient):
        self._client = client

    async def create(self, *, agent_id: str, payload: dict, budget: str, timeout_ms: int | None = None) -> dict[str, Any]:
        raw = await self._client.post("/v1/tasks", json=_build_create_body(agent_id, payload, budget, timeout_ms))
        result = _reshape_create_response(raw)
        analytics.capture(
            distinct_id=agent_id,
            event="task_created",
            properties={"agent_id": agent_id, "budget": budget, "has_timeout": timeout_ms is not None, "task_id": raw.get("id")},
        )
        return result

    async def get(self, task_id: str) -> dict[str, Any]:
        return await self._client.get(f"/v1/tasks/{quote(task_id)}")

    async def complete(self, task_id: str, *, result: dict, completion_token: str, proof: str | None = None) -> dict[str, Any]:
        response = await self._client.post(f"/v1/tasks/{quote(task_id)}/complete", json=_build_complete_body(result, completion_token, proof))
        analytics.capture(distinct_id=task_id, event="task_completed", properties={"task_id": task_id, "has_proof": proof is not None})
        return response

    async def dispute(self, task_id: str, *, reason: str, evidence: str | None = None) -> dict[str, Any]:
        response = await self._client.post(f"/v1/tasks/{quote(task_id)}/dispute", json=_build_dispute_body(reason, evidence))
        analytics.capture(distinct_id=task_id, event="task_disputed", properties={"task_id": task_id, "has_evidence": evidence is not None})
        return response
