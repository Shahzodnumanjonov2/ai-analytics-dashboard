# core/views.py
import os
import psutil
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response

from supabase import create_client
from .metrics import (
    CPU_USAGE, RAM_USAGE, ACTIVE_USERS_24H, AI_MSGS_PER_MIN
)

router = APIRouter()

# --- Supabase client (READ ONLY) ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

def iso_utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()

def count_active_users_24h() -> int:
    if not sb: return 0
    since = iso_utc(datetime.utcnow() - timedelta(hours=24))
    ids = set()
    for table in ("aisum_app", "aisum_tgbot"):
        res = sb.table(table).select("chat_id,created_at").gte("created_at", since).execute()
        for r in (res.data or []):
            if r.get("chat_id") is not None:
                ids.add(r["chat_id"])
    return len(ids)

def ai_msgs_last_min() -> int:
    if not sb: return 0
    since = iso_utc(datetime.utcnow() - timedelta(minutes=1))
    cnt = 0
    for table in ("aisum_app", "aisum_tgbot"):
        res = sb.table(table).select("ai_message,created_at").gte("created_at", since).execute()
        for r in (res.data or []):
            msg = r.get("ai_message")
            if msg and str(msg).strip() != "":
                cnt += 1
    return cnt

@router.get("/metrics")
def metrics():
    # system gauges
    CPU_USAGE.set(psutil.cpu_percent())
    RAM_USAGE.set(psutil.virtual_memory().used / 1024 / 1024)

    # business gauges (READ only — RLS SELECT kerak)
    try:
        ACTIVE_USERS_24H.set(count_active_users_24h())
        AI_MSGS_PER_MIN.set(ai_msgs_last_min())
    except Exception:
        # supabase off bo'lsa ham /metrics yiqilmasin
        pass

    data = generate_latest()
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)

@router.get("/healthz")
def healthz():
    return {"ok": True, "time": datetime.utcnow().isoformat()}