from __future__ import annotations

from typing import Any
from urllib.parse import quote

from ..client import HttpClient


class AgentsResource:
    def __init__(self, client: HttpClient):
        self._client = client

    def register(self, params: dict[str, Any]) -> dict[str, Any]:
        # Convert snake_case params to camelCase for API
        body = {
            "agentId": params["agent_id"],
            "name": params["name"],
            "description": params["description"],
            "endpoint": params["endpoint"],
            "priceUsdc": params["price_usdc"],
            "category": params["category"],
        }
        if "tags" in params:
            body["tags"] = params["tags"]
        return self._client.post("/v1/agents", json=body)

    def list(self, **kwargs: Any) -> dict[str, Any]:
        return self._client.get_paginated("/v1/agents", params=kwargs or None)

    def get(self, agent_id: str) -> dict[str, Any]:
        return self._client.get(f"/v1/agents/{quote(agent_id)}")

    def update(self, agent_id: str, **kwargs: Any) -> dict[str, Any]:
        # Convert snake_case to camelCase
        body: dict[str, Any] = {}
        key_map = {"price_usdc": "priceUsdc"}
        for k, v in kwargs.items():
            body[key_map.get(k, k)] = v
        return self._client.put(f"/v1/agents/{quote(agent_id)}", json=body)

    def delist(self, agent_id: str) -> dict[str, Any]:
        return self._client.delete(f"/v1/agents/{quote(agent_id)}")
