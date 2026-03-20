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
