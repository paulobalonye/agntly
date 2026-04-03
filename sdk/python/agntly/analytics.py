"""Optional PostHog analytics for the Agntly Python SDK.

Analytics are only active when both ``posthog`` is installed AND the
``POSTHOG_PROJECT_TOKEN`` environment variable is set.  The SDK works
perfectly without either.
"""

from __future__ import annotations

import atexit
import os
from typing import Any

_client: Any = None


def _init_client() -> Any:
    """Lazily initialise the PostHog client on first use."""
    global _client  # noqa: PLW0603
    if _client is not None:
        return _client

    try:
        from posthog import Posthog  # type: ignore[import-untyped]
    except ImportError:
        _client = False  # sentinel — posthog not installed
        return _client

    token = os.getenv("POSTHOG_PROJECT_TOKEN")
    if not token:
        _client = False
        return _client

    host = os.getenv("POSTHOG_HOST")
    _client = Posthog(token, host=host)
    atexit.register(_client.shutdown)
    return _client


def capture(distinct_id: str, event: str, properties: dict[str, Any] | None = None) -> None:
    """Capture an analytics event if PostHog is configured."""
    client = _init_client()
    if not client:
        return
    try:
        client.capture(distinct_id=distinct_id, event=event, properties=properties or {})
    except Exception:
        pass  # analytics must never break the SDK
