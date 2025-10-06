# core/middleware/metrics.py
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from .metrics_runtime import record_request

class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        t0 = time.perf_counter()
        ok = True
        try:
            response: Response = await call_next(request)
            return response
        except Exception:
            ok = False
            raise
        finally:
            dt_ms = (time.perf_counter() - t0) * 1000.0
            # Agar AI javobi bo'lsa tokens/cost ni shu yerga qo'shing (contextdan)
            record_request(latency_ms=dt_ms, ok=ok, tokens=None, cost=None)