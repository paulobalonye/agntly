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
