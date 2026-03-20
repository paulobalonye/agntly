import httpx
import json
import respx

from agntly.client import HttpClient
from agntly.resources.wallets import WalletsResource

BASE = "https://sandbox.api.agntly.io"


def _ok(data):
    return httpx.Response(200, json={"success": True, "data": data, "error": None})


def _ok_paginated(data, meta):
    return httpx.Response(200, json={"success": True, "data": data, "error": None, "meta": meta})


@respx.mock
def test_create_with_agent_id():
    route = respx.post(f"{BASE}/v1/wallets").mock(return_value=_ok({"id": "wal_1", "balance": "0.000000"}))
    client = HttpClient(api_key="key")
    wallets = WalletsResource(client)
    result = wallets.create(agent_id="my-agent")
    assert result["id"] == "wal_1"
    body = json.loads(route.calls[0].request.content)
    assert body["agentId"] == "my-agent"


@respx.mock
def test_get_by_id():
    respx.get(f"{BASE}/v1/wallets/wal_1").mock(return_value=_ok({"id": "wal_1", "balance": "50.000000"}))
    client = HttpClient(api_key="key")
    wallets = WalletsResource(client)
    result = wallets.get("wal_1")
    assert result["balance"] == "50.000000"


@respx.mock
def test_fund_sends_amount_and_method():
    route = respx.post(f"{BASE}/v1/wallets/wal_1/fund").mock(return_value=_ok({
        "depositId": "dep_1", "amountUsd": 10, "usdcAmount": "9.850000", "status": "confirmed", "etaSeconds": 30,
    }))
    client = HttpClient(api_key="key")
    wallets = WalletsResource(client)
    result = wallets.fund("wal_1", amount_usd=10, method="card")
    assert result["usdcAmount"] == "9.850000"
    body = json.loads(route.calls[0].request.content)
    assert body["method"] == "card"


@respx.mock
def test_withdraw_sends_body():
    respx.post(f"{BASE}/v1/wallets/wal_1/withdraw").mock(return_value=_ok({
        "withdrawalId": "wth_1", "amount": "5.000000", "destination": "0xabc", "fee": "0.000000", "status": "queued",
    }))
    client = HttpClient(api_key="key")
    wallets = WalletsResource(client)
    result = wallets.withdraw("wal_1", amount="5.000000", destination="0xabc")
    assert result["status"] == "queued"


@respx.mock
def test_withdrawals_returns_paginated():
    respx.get(f"{BASE}/v1/wallets/wal_1/withdrawals").mock(return_value=_ok_paginated(
        [{"withdrawalId": "wth_1"}], {"total": 5, "limit": 20, "offset": 0},
    ))
    client = HttpClient(api_key="key")
    wallets = WalletsResource(client)
    result = wallets.withdrawals("wal_1")
    assert len(result["data"]) == 1
    assert result["meta"]["total"] == 5
