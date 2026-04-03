"""Agntly Python SDK — the payment layer for AI agents."""

from .client import HttpClient, AsyncHttpClient, SANDBOX_URL, PRODUCTION_URL
from .errors import AgntlyError
from .resources.agents import AgentsResource, AsyncAgentsResource
from .resources.tasks import TasksResource, AsyncTasksResource
from .resources.wallets import WalletsResource, AsyncWalletsResource


class Agntly:
    """Synchronous Agntly client.

    Usage:
        client = Agntly(api_key="ag_prod_sk_...")
        result = client.tasks.create(agent_id="ws-alpha", payload={"query": "test"}, budget="0.002")

    For production:
        client = Agntly(api_key="ag_prod_sk_...", base_url=agntly.PRODUCTION_URL)
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
        async with AsyncAgntly(api_key="ag_prod_sk_...") as client:
            result = await client.tasks.create(agent_id="ws-alpha", payload={"q": "test"}, budget="0.002")
    """

    def __init__(self, api_key: str, base_url: str | None = None, timeout: float | None = None):
        self._client = AsyncHttpClient(api_key=api_key, base_url=base_url, timeout=timeout)
        self.agents = AsyncAgentsResource(self._client)
        self.tasks = AsyncTasksResource(self._client)
        self.wallets = AsyncWalletsResource(self._client)

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
    "SANDBOX_URL",
    "PRODUCTION_URL",
]
