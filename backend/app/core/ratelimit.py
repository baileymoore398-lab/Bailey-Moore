"""Rate limiting.

Two layers:
  * ``limiter`` — a slowapi Limiter applied app-wide via SlowAPIMiddleware in
    main.py (a default per-IP ceiling on every endpoint).
  * ``rate_limit(...)`` — a FastAPI dependency for tight per-endpoint limits on
    abuse-prone routes (contact form, password reset, analyze, video). Used as a
    dependency rather than slowapi's ``@limiter.limit`` decorator because the
    routers use ``from __future__ import annotations``, which breaks slowapi's
    signature-wrapping for endpoints that take a Pydantic body.

Both are disabled under the test suite (ENV=test) so the hermetic tests aren't
throttled. The dependency uses an in-process fixed-window counter; set
RATE_LIMIT_STORAGE_URI to a Redis URL to make the slowapi global limit shared
across instances.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.RATE_LIMIT_DEFAULT],
    storage_uri=settings.RATE_LIMIT_STORAGE_URI or None,
    enabled=settings.RATE_LIMIT_ENABLED and settings.ENV != "test",
)

_enabled = settings.RATE_LIMIT_ENABLED and settings.ENV != "test"
_buckets: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def rate_limit(max_calls: int, window_s: int, scope: str):
    """Return a dependency that allows ``max_calls`` per ``window_s`` per client IP."""

    def _dep(request: Request) -> None:
        if not _enabled:
            return
        ip = request.client.host if request.client else "unknown"
        key = f"{scope}:{ip}"
        now = time.time()
        cutoff = now - window_s
        with _lock:
            bucket = _buckets[key]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= max_calls:
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    "Too many requests — please try again later.",
                )
            bucket.append(now)

    return _dep
