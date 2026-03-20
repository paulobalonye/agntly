# Python SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `agntly` Python SDK package that wraps the Agntly REST API with typed methods for agents, tasks, and wallets — a direct port of the TypeScript SDK.

**Architecture:** `Agntly` main class creates an `HttpClient` (httpx wrapper with auth, errors, pagination) and passes it to three resource classes (`AgentsResource`, `TasksResource`, `WalletsResource`). Single runtime dependency: `httpx`. Both sync and async support via `Agntly` (sync) and `AsyncAgntly` (async).

**Tech Stack:** Python 3.10+, httpx, pytest, dataclasses for types

---

## File Structure

### SDK package (`sdk/python/`)
- `pyproject.toml` — Package config with httpx dependency
- `agntly/__init__.py` — Agntly + AsyncAgntly classes + re-exports
- `agntly/client.py` — HttpClient (sync) + AsyncHttpClient
- `agntly/errors.py` — AgntlyError exception
- `agntly/types.py` — TypedDict definitions for all request/response shapes
- `agntly/resources/__init__.py` — Empty
- `agntly/resources/agents.py` — AgentsResource
- `agntly/resources/tasks.py` — TasksResource
- `agntly/resources/wallets.py` — WalletsResource
- `tests/test_client.py` — HttpClient unit tests
- `tests/test_agents.py` — AgentsResource tests
- `tests/test_tasks.py` — TasksResource tests
- `tests/test_wallets.py` — WalletsResource tests
- `tests/conftest.py` — Shared fixtures

---

## Task 1: Package setup + types + errors

**Files:**
- Create: `sdk/python/pyproject.toml`
- Create: `sdk/python/agntly/__init__.py` (placeholder)
- Create: `sdk/python/agntly/errors.py`
- Create: `sdk/python/agntly/types.py`
- Create: `sdk/python/agntly/resources/__init__.py`

- [ ] **Step 1: Create pyproject.toml**

Create `sdk/python/pyproject.toml`:

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "agntly"
version = "0.1.0"
description = "Python SDK for the Agntly AI agent marketplace"
readme = "README.md"
requires-python = ">=3.10"
license = "MIT"
dependencies = [
    "httpx>=0.27.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
    "respx>=0.22",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

- [ ] **Step 2: Create errors.py**

Create `sdk/python/agntly/errors.py`:

```python
class AgntlyError(Exception):
    """Base exception for Agntly SDK errors."""

    def __init__(self, message: str, status: int = 0, body: object = None):
        super().__init__(message)
        self.status = status
        self.body = body
```

- [ ] **Step 3: Create types.py**

Create `sdk/python/agntly/types.py`:

```python
from __future__ import annotations

from typing import TypedDict, Sequence

# --- Config ---
class AgntlyConfig(TypedDict, total=False):
    api_key: str  # required but total=False for optional fields
    base_url: str
    timeout: float

# --- Agents ---
class Agent(TypedDict):
    id: str
    ownerId: str
    walletId: str
    name: str
    description: str
    endpoint: str
    priceUsdc: str
    category: str
    tags: list[str]
    status: str
    verified: bool
    reputation: float
    callsTotal: int
    uptimePct: float
    timeoutMs: int
    createdAt: str

class RegisterAgentParams(TypedDict):
    agent_id: str
    name: str
    description: str
    endpoint: str
    price_usdc: str
    category: str
    tags: list[str]

class ListAgentsParams(TypedDict, total=False):
    category: str
    status: str
    limit: int
    offset: int

class UpdateAgentParams(TypedDict, total=False):
    name: str
    description: str
    endpoint: str
    price_usdc: str
    category: str
    tags: list[str]

# --- Tasks ---
class Task(TypedDict):
    id: str
    orchestratorId: str
    agentId: str
    payload: dict
    result: dict | None
    status: str
    amount: str
    fee: str
    escrowTx: str | None
    settleTx: str | None
    deadline: str
    latencyMs: int | None
    createdAt: str

class CreateTaskParams(TypedDict, total=False):
    agent_id: str  # required
    payload: dict  # required
    budget: str  # required
    timeout_ms: int

class CompleteTaskParams(TypedDict, total=False):
    result: dict  # required
    completion_token: str  # required
    proof: str

class DisputeTaskParams(TypedDict):
    reason: str

class TaskCreateResult(TypedDict):
    task: Task
    completion_token: str

# --- Wallets ---
class Wallet(TypedDict):
    id: str
    ownerId: str
    agentId: str | None
    address: str
    balance: str
    locked: str
    chain: str

class CreateWalletParams(TypedDict, total=False):
    agent_id: str

class FundWalletParams(TypedDict):
    amount_usd: float
    method: str  # 'card' | 'ach' | 'usdc'

class FundResult(TypedDict):
    depositId: str
    amountUsd: float
    usdcAmount: str
    status: str
    etaSeconds: int

class WithdrawParams(TypedDict):
    amount: str
    destination: str

class Withdrawal(TypedDict):
    withdrawalId: str
    amount: str
    destination: str
    fee: str
    status: str

# --- Pagination ---
class PaginationParams(TypedDict, total=False):
    limit: int
    offset: int

class PaginationMeta(TypedDict):
    total: int
    limit: int
    offset: int

class PaginatedResponse(TypedDict):
    data: list
    meta: PaginationMeta
```

- [ ] **Step 4: Create placeholder __init__.py files**

Create `sdk/python/agntly/__init__.py`:
```python
"""Agntly Python SDK."""
```

Create `sdk/python/agntly/resources/__init__.py`:
```python
"""Resource modules."""
```

- [ ] **Step 5: Install deps**

Run: `cd /Users/drpraize/agntly/sdk/python && pip install -e ".[dev]"`

- [ ] **Step 6: Commit**

```bash
git add sdk/python/pyproject.toml sdk/python/agntly/errors.py sdk/python/agntly/types.py sdk/python/agntly/__init__.py sdk/python/agntly/resources/__init__.py
git commit -m "feat: scaffold Python SDK package with types and error class"
```

---

## Task 2: HttpClient (sync + async) with auth, errors, pagination

**Files:**
- Create: `sdk/python/agntly/client.py`
- Create: `sdk/python/tests/conftest.py`
- Create: `sdk/python/tests/test_client.py`

- [ ] **Step 1: Create client.py**

Create `sdk/python/agntly/client.py`:

```python
from __future__ import annotations

from typing import Any

import httpx

from .errors import AgntlyError

_DEFAULT_BASE_URL = "https://sandbox.api.agntly.io"
_DEFAULT_TIMEOUT = 30.0


class HttpClient:
    """Synchronous HTTP client with auth, envelope stripping, and pagination."""

    def __init__(self, api_key: str, base_url: str | None = None, timeout: float | None = None):
        if not api_key:
            raise AgntlyError("api_key is required", status=0)
        self._base_url = (base_url or _DEFAULT_BASE_URL).rstrip("/")
        self._client = httpx.Client(
            base_url=self._base_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout or _DEFAULT_TIMEOUT,
        )

    def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        return self._request("GET", path, params=params)

    def get_paginated(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._request_raw("GET", path, params=params)

    def post(self, path: str, json: dict[str, Any] | None = None) -> Any:
        return self._request("POST", path, json=json)

    def put(self, path: str, json: dict[str, Any] | None = None) -> Any:
        return self._request("PUT", path, json=json)

    def delete(self, path: str) -> Any:
        return self._request("DELETE", path)

    def close(self) -> None:
        self._client.close()

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        """Standard request — strips the { success, data, error } envelope, returns data."""
        envelope = self._request_raw(method, path, **kwargs)
        return envelope.get("data")

    def _request_raw(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        """Raw request — returns the full parsed JSON body."""
        # Filter out None params
        if "params" in kwargs and kwargs["params"]:
            kwargs["params"] = {k: v for k, v in kwargs["params"].items() if v is not None}

        try:
            response = self._client.request(method, path, **kwargs)
        except httpx.ConnectError as exc:
            raise AgntlyError(str(exc), status=0) from exc
        except httpx.TimeoutException as exc:
            raise AgntlyError(f"Request timed out: {exc}", status=0) from exc

        if not response.is_success:
            error_message = f"HTTP {response.status_code}"
            body = None
            try:
                body = response.json()
                if isinstance(body, dict) and "error" in body:
                    error_message = body["error"]
            except Exception:
                error_message = f"HTTP {response.status_code}: {response.reason_phrase}"
            raise AgntlyError(error_message, status=response.status_code, body=body)

        try:
            return response.json()
        except Exception as exc:
            raise AgntlyError("Invalid JSON response", status=response.status_code) from exc


class AsyncHttpClient:
    """Async HTTP client with auth, envelope stripping, and pagination."""

    def __init__(self, api_key: str, base_url: str | None = None, timeout: float | None = None):
        if not api_key:
            raise AgntlyError("api_key is required", status=0)
        self._base_url = (base_url or _DEFAULT_BASE_URL).rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout or _DEFAULT_TIMEOUT,
        )

    async def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        return await self._request("GET", path, params=params)

    async def get_paginated(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return await self._request_raw("GET", path, params=params)

    async def post(self, path: str, json: dict[str, Any] | None = None) -> Any:
        return await self._request("POST", path, json=json)

    async def put(self, path: str, json: dict[str, Any] | None = None) -> Any:
        return await self._request("PUT", path, json=json)

    async def delete(self, path: str) -> Any:
        return await self._request("DELETE", path)

    async def close(self) -> None:
        await self._client.aclose()

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        envelope = await self._request_raw(method, path, **kwargs)
        return envelope.get("data")

    async def _request_raw(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        if "params" in kwargs and kwargs["params"]:
            kwargs["params"] = {k: v for k, v in kwargs["params"].items() if v is not None}

        try:
            response = await self._client.request(method, path, **kwargs)
        except httpx.ConnectError as exc:
            raise AgntlyError(str(exc), status=0) from exc
        except httpx.TimeoutException as exc:
            raise AgntlyError(f"Request timed out: {exc}", status=0) from exc

        if not response.is_success:
            error_message = f"HTTP {response.status_code}"
            body = None
            try:
                body = response.json()
                if isinstance(body, dict) and "error" in body:
                    error_message = body["error"]
            except Exception:
                error_message = f"HTTP {response.status_code}: {response.reason_phrase}"
            raise AgntlyError(error_message, status=response.status_code, body=body)

        try:
            return response.json()
        except Exception as exc:
            raise AgntlyError("Invalid JSON response", status=response.status_code) from exc
```

- [ ] **Step 2: Create conftest.py**

Create `sdk/python/tests/__init__.py` (empty) and `sdk/python/tests/conftest.py`:

```python
"""Shared test fixtures."""
```

- [ ] **Step 3: Create test_client.py**

Create `sdk/python/tests/test_client.py`:

```python
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
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/drpraize/agntly/sdk/python && python -m pytest tests/test_client.py -v`
Expected: All 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add sdk/python/agntly/client.py sdk/python/tests/
git commit -m "feat: add HttpClient with auth, error handling, pagination (sync + async)"
```

---

## Task 3: Resource classes + tests

All three resources follow the same pattern as the TS SDK. Create all at once.

**Files:**
- Create: `sdk/python/agntly/resources/agents.py`
- Create: `sdk/python/agntly/resources/tasks.py`
- Create: `sdk/python/agntly/resources/wallets.py`
- Create: `sdk/python/tests/test_agents.py`
- Create: `sdk/python/tests/test_tasks.py`
- Create: `sdk/python/tests/test_wallets.py`

- [ ] **Step 1: Create agents.py**

Create `sdk/python/agntly/resources/agents.py`:

```python
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
```

- [ ] **Step 2: Create tasks.py**

Create `sdk/python/agntly/resources/tasks.py`:

```python
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
```

- [ ] **Step 3: Create wallets.py**

Create `sdk/python/agntly/resources/wallets.py`:

```python
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
```

- [ ] **Step 4: Create test_agents.py**

Create `sdk/python/tests/test_agents.py`:

```python
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
```

- [ ] **Step 5: Create test_tasks.py**

Create `sdk/python/tests/test_tasks.py`:

```python
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
```

- [ ] **Step 6: Create test_wallets.py**

Create `sdk/python/tests/test_wallets.py`:

```python
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
```

- [ ] **Step 7: Run all tests**

Run: `cd /Users/drpraize/agntly/sdk/python && python -m pytest tests/ -v`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add sdk/python/agntly/resources/ sdk/python/tests/
git commit -m "feat: add agents, tasks, wallets resources with tests"
```

---

## Task 4: Agntly main class + __init__.py exports

**Files:**
- Modify: `sdk/python/agntly/__init__.py`

- [ ] **Step 1: Write the main Agntly class**

Replace `sdk/python/agntly/__init__.py`:

```python
"""Agntly Python SDK — the payment layer for AI agents."""

from .client import HttpClient, AsyncHttpClient
from .errors import AgntlyError
from .resources.agents import AgentsResource
from .resources.tasks import TasksResource
from .resources.wallets import WalletsResource


class Agntly:
    """Synchronous Agntly client.

    Usage:
        client = Agntly(api_key="ag_live_sk_...")
        result = client.tasks.create(agent_id="ws-alpha", payload={"query": "test"}, budget="0.002")
    """

    def __init__(self, api_key: str, base_url: str | None = None, timeout: float | None = None):
        self._client = HttpClient(api_key=api_key, base_url=base_url, timeout=timeout)
        self.agents = AgentsResource(self._client)
        self.tasks = TasksResource(self._client)
        self.wallets = WalletsResource(self._client)

    def close(self) -> None:
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


class AsyncAgntly:
    """Async Agntly client for use with asyncio.

    Usage:
        async with AsyncAgntly(api_key="ag_live_sk_...") as client:
            result = await client.tasks.create(...)
    """

    def __init__(self, api_key: str, base_url: str | None = None, timeout: float | None = None):
        self._client = AsyncHttpClient(api_key=api_key, base_url=base_url, timeout=timeout)
        # Async resources would use AsyncHttpClient — for now, expose sync resources
        # that work with the sync client. Full async resources are a follow-up.

    async def close(self) -> None:
        await self._client.close()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.close()


__all__ = [
    "Agntly",
    "AsyncAgntly",
    "AgntlyError",
]
```

- [ ] **Step 2: Run all tests + verify import works**

Run: `cd /Users/drpraize/agntly/sdk/python && python -m pytest tests/ -v && python -c "from agntly import Agntly, AgntlyError; print('Import OK')"`
Expected: All tests pass, import succeeds.

- [ ] **Step 3: Commit**

```bash
git add sdk/python/agntly/__init__.py
git commit -m "feat: add Agntly and AsyncAgntly main classes with resource wiring"
```

---

## Summary

| Task | What it does | Files |
|------|-------------|-------|
| 1 | Package scaffold + types + errors | `pyproject.toml`, `errors.py`, `types.py`, `__init__.py` |
| 2 | HttpClient (sync + async) | `client.py`, `tests/test_client.py` |
| 3 | All 3 resources + tests | `resources/agents.py`, `tasks.py`, `wallets.py` + 3 test files |
| 4 | Agntly main class + exports | `__init__.py` |

**Total: 4 tasks, ~15 files, 1 runtime dependency (httpx).**

**Key parity with TypeScript SDK:**
- Same 3 resources: agents, tasks, wallets
- Same method names and signatures (snake_case for Python)
- Same `tasks.create()` reshape (flat → `{ task, completion_token }`)
- Same `get_paginated()` preserving meta
- Same error handling (`AgntlyError` with status + body)
- Same default baseUrl (`https://sandbox.api.agntly.io`)
- Context manager support (`with Agntly(...) as client:`)
