# core/urls.py
import os
from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from .middleware.metrics import MetricsMiddleware
from .views import router as metrics_router

app = FastAPI(title="SinoAI Analytics")

# middleware
app.add_middleware(MetricsMiddleware)

# routes (metrics/healthz)
app.include_router(metrics_router)

# --- Static (frontend) ---  # <== ENDPOINTLARDAN KEYIN /ui ga mount qilamiz
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public")
if os.path.isdir(PUBLIC_DIR):
    app.mount("/ui", StaticFiles(directory=PUBLIC_DIR, html=True), name="public")

    @app.get("/")
    def root():
        # Asosiy manzilni /ui ga yo'naltiramiz
        return RedirectResponse(url="/ui/")