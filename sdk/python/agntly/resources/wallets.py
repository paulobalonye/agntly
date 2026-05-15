from __future__ import annotations

from typing import Any
from urllib.parse import quote

from ..client import HttpClient, AsyncHttpClient
from .. import analytics


class WalletsResource:
    def __init__(self, client: HttpClient):
        self._client = client

    def create(self, agent_id: str | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {}
        if agent_id is not None:
            body["agentId"] = agent_id
        result = self._client.post("/v1/wallets", json=body)
        distinct_id = agent_id or (result.get("id") if result else "anonymous")
        analytics.capture(
            distinct_id=distinct_id,
            event="wallet_created",
            properties={"linked_to_agent": agent_id is not None, "wallet_id": result.get("id") if result else None},
        )
        return result

    def get(self, wallet_id: str) -> dict[str, Any]:
        return self._client.get(f"/v1/wallets/{quote(wallet_id)}")

    def fund(self, wallet_id: str, *, amount_usd: float, method: str) -> dict[str, Any]:
        result = self._client.post(f"/v1/wallets/{quote(wallet_id)}/fund", json={"amountUsd": amount_usd, "method": method})
        analytics.capture(
            distinct_id=wallet_id,
            event="wallet_funded",
            properties={"wallet_id": wallet_id, "amount_usd": amount_usd, "method": method},
        )
        return result

    def withdraw(self, wallet_id: str, *, amount: str, destination: str) -> dict[str, Any]:
        result = self._client.post(f"/v1/wallets/{quote(wallet_id)}/withdraw", json={"amount": amount, "destination": destination})
        analytics.capture(
            distinct_id=wallet_id,
            event="wallet_withdrawn",
            properties={"wallet_id": wallet_id, "amount": amount},
        )
        return result

    def withdrawals(self, wallet_id: str, limit: int = 20, offset: int = 0) -> dict[str, Any]:
        return self._client.get_paginated(
            f"/v1/wallets/{quote(wallet_id)}/withdrawals",
            params={"limit": limit, "offset": offset},
        )


class AsyncWalletsResource:
    def __init__(self, client: AsyncHttpClient):
        self._client = client

    async def create(self, agent_id: str | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {}
        if agent_id is not None:
            body["agentId"] = agent_id
        result = await self._client.post("/v1/wallets", json=body)
        distinct_id = agent_id or (result.get("id") if result else "anonymous")
        analytics.capture(
            distinct_id=distinct_id,
            event="wallet_created",
            properties={"linked_to_agent": agent_id is not None, "wallet_id": result.get("id") if result else None},
        )
        return result

    async def get(self, wallet_id: str) -> dict[str, Any]:
        return await self._client.get(f"/v1/wallets/{quote(wallet_id)}")

    async def fund(self, wallet_id: str, *, amount_usd: float, method: str) -> dict[str, Any]:
        result = await self._client.post(f"/v1/wallets/{quote(wallet_id)}/fund", json={"amountUsd": amount_usd, "method": method})
        analytics.capture(
            distinct_id=wallet_id,
            event="wallet_funded",
            properties={"wallet_id": wallet_id, "amount_usd": amount_usd, "method": method},
        )
        return result

    async def withdraw(self, wallet_id: str, *, amount: str, destination: str) -> dict[str, Any]:
        result = await self._client.post(f"/v1/wallets/{quote(wallet_id)}/withdraw", json={"amount": amount, "destination": destination})
        analytics.capture(
            distinct_id=wallet_id,
            event="wallet_withdrawn",
            properties={"wallet_id": wallet_id, "amount": amount},
        )
        return result

    async def withdrawals(self, wallet_id: str, limit: int = 20, offset: int = 0) -> dict[str, Any]:
        return await self._client.get_paginated(
            f"/v1/wallets/{quote(wallet_id)}/withdrawals",
            params={"limit": limit, "offset": offset},
        )
