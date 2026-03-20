from __future__ import annotations

from typing import Any
from urllib.parse import quote

from ..client import HttpClient


class WalletsResource:
    def __init__(self, client: HttpClient):
        self._client = client

    def create(self, agent_id: str | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {}
        if agent_id is not None:
            body["agentId"] = agent_id
        return self._client.post("/v1/wallets", json=body)

    def get(self, wallet_id: str) -> dict[str, Any]:
        return self._client.get(f"/v1/wallets/{quote(wallet_id)}")

    def fund(self, wallet_id: str, *, amount_usd: float, method: str) -> dict[str, Any]:
        return self._client.post(f"/v1/wallets/{quote(wallet_id)}/fund", json={
            "amountUsd": amount_usd,
            "method": method,
        })

    def withdraw(self, wallet_id: str, *, amount: str, destination: str) -> dict[str, Any]:
        return self._client.post(f"/v1/wallets/{quote(wallet_id)}/withdraw", json={
            "amount": amount,
            "destination": destination,
        })

    def withdrawals(self, wallet_id: str, limit: int = 20, offset: int = 0) -> dict[str, Any]:
        return self._client.get_paginated(
            f"/v1/wallets/{quote(wallet_id)}/withdrawals",
            params={"limit": limit, "offset": offset},
        )
