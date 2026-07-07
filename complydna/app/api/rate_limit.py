from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, status


class InMemoryRateLimiter:
    def __init__(self, limit: int, window_seconds: int = 60) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        events = self._events[key]
        cutoff = now - self.window_seconds

        while events and events[0] <= cutoff:
            events.popleft()

        if len(events) >= self.limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
            )

        events.append(now)

    def reset(self) -> None:
        self._events.clear()
