from __future__ import annotations

from typing import Any
from urllib.parse import quote

from ..client import HttpClient


class TasksResource:
    def __init__(self, client: HttpClient):
        self._client = client

    def create(self, *, agent_id: str, payload: dict, budget: str, timeout_ms: int | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {"agentId": agent_id, "payload": payload, "budget": budget}
        if timeout_ms is not None:
            body["timeoutMs"] = timeout_ms
        raw = self._client.post("/v1/tasks", json=body)
        # Server returns flat { ...taskFields, completionToken }
        # Reshape into { task, completion_token }
        completion_token = raw.pop("completionToken", None)
        return {"task": raw, "completion_token": completion_token}

    def get(self, task_id: str) -> dict[str, Any]:
        return self._client.get(f"/v1/tasks/{quote(task_id)}")

    def complete(self, task_id: str, *, result: dict, completion_token: str, proof: str | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {"result": result, "completionToken": completion_token}
        if proof is not None:
            body["proof"] = proof
        return self._client.post(f"/v1/tasks/{quote(task_id)}/complete", json=body)

    def dispute(self, task_id: str, *, reason: str, evidence: str | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {"reason": reason}
        if evidence is not None:
            body["evidence"] = evidence
        return self._client.post(f"/v1/tasks/{quote(task_id)}/dispute", json=body)
