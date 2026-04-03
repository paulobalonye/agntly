from __future__ import annotations

from typing import Any
from urllib.parse import quote

from ..client import HttpClient, AsyncHttpClient
from .. import analytics


def _build_register_body(params: dict[str, Any]) -> dict[str, Any]:
    """Convert snake_case register params to camelCase API body."""
    body: dict[str, Any] = {
        "agentId": params["agent_id"],
        "name": params["name"],
        "description": params["description"],
        "endpoint": params["endpoint"],
        "priceUsdc": params["price_usdc"],
        "category": params["category"],
    }
    if "tags" in params:
        body["tags"] = params["tags"]
    return body


def _build_update_body(**kwargs: Any) -> dict[str, Any]:
    """Convert snake_case update kwargs to camelCase API body."""
    key_map = {"price_usdc": "priceUsdc"}
    return {key_map.get(k, k): v for k, v in kwargs.items()}


class AgentsResource:
    def __init__(self, client: HttpClient):
        self._client = client

    def register(self, params: dict[str, Any]) -> dict[str, Any]:
        body = _build_register_body(params)
        result = self._client.post("/v1/agents", json=body)
        analytics.capture(
            distinct_id=params["agent_id"],
            event="agent_registered",
            properties={
                "agent_id": params["agent_id"],
                "category": params["category"],
                "has_tags": "tags" in params,
            },
        )
        return result

    def list(self, **kwargs: Any) -> dict[str, Any]:
        return self._client.get_paginated("/v1/agents", params=kwargs or None)

    def get(self, agent_id: str) -> dict[str, Any]:
        return self._client.get(f"/v1/agents/{quote(agent_id)}")

    def update(self, agent_id: str, **kwargs: Any) -> dict[str, Any]:
        return self._client.put(f"/v1/agents/{quote(agent_id)}", json=_build_update_body(**kwargs))

    def delist(self, agent_id: str) -> dict[str, Any]:
        result = self._client.delete(f"/v1/agents/{quote(agent_id)}")
        analytics.capture(
            distinct_id=agent_id,
            event="agent_delisted",
            properties={"agent_id": agent_id},
        )
        return result


class AsyncAgentsResource:
    def __init__(self, client: AsyncHttpClient):
        self._client = client

    async def register(self, params: dict[str, Any]) -> dict[str, Any]:
        body = _build_register_body(params)
        result = await self._client.post("/v1/agents", json=body)
        analytics.capture(
            distinct_id=params["agent_id"],
            event="agent_registered",
            properties={
                "agent_id": params["agent_id"],
                "category": params["category"],
                "has_tags": "tags" in params,
            },
        )
        return result

    async def list(self, **kwargs: Any) -> dict[str, Any]:
        return await self._client.get_paginated("/v1/agents", params=kwargs or None)

    async def get(self, agent_id: str) -> dict[str, Any]:
        return await self._client.get(f"/v1/agents/{quote(agent_id)}")

    async def update(self, agent_id: str, **kwargs: Any) -> dict[str, Any]:
        return await self._client.put(f"/v1/agents/{quote(agent_id)}", json=_build_update_body(**kwargs))

    async def delist(self, agent_id: str) -> dict[str, Any]:
        result = await self._client.delete(f"/v1/agents/{quote(agent_id)}")
        analytics.capture(
            distinct_id=agent_id,
            event="agent_delisted",
            properties={"agent_id": agent_id},
        )
        return result
