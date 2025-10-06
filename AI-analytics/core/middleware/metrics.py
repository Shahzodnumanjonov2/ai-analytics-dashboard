# core/middleware/metrics.py
import time
from starlette.types import ASGIApp, Receive, Scope, Send
from ..metrics import REQUEST_COUNT, REQUEST_LATENCY

class MetricsMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        start = time.time()
        method = scope.get("method", "GET")
        path = scope.get("path", "/").replace("/", "_") or "root"

        async def _send(message):
            if message.get("type") == "http.response.start":
                # request count
                REQUEST_COUNT.labels(method, path).inc()
                # latency
                REQUEST_LATENCY.labels(path).observe(time.time() - start)
            await send(message)

        await self.app(scope, receive, _send)