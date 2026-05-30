import asyncio
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, Response
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.orm import Session
import httpx

_PENDING_TTL = 300        # seconds before a pending entry expires
_MAX_PENDING = 200        # max simultaneous pending sessions

# session_id → {session_token, athlete_name, expires_at}
_pending_sessions: dict[str, dict] = {}
# state → expires_at  (one entry per in-flight OAuth login)
_pending_states: dict[str, float] = {}


def _cleanup_pending() -> None:
    now = time.time()
    for k in [k for k, v in _pending_sessions.items() if v["expires_at"] < now]:
        del _pending_sessions[k]
    for k in [k for k, v in _pending_states.items() if v < now]:
        del _pending_states[k]

from database import engine, get_db, Base
import models

load_dotenv()

Base.metadata.create_all(bind=engine)


def _migrate_db() -> None:
    """Add columns introduced after initial schema without dropping existing data."""
    with engine.connect() as conn:
        for stmt in [
            "ALTER TABLE athletes ADD COLUMN token_expires_at INTEGER DEFAULT 0",
            "ALTER TABLE athletes ADD COLUMN session_token TEXT",
        ]:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass  # column already exists


_migrate_db()

STRAVA_CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
STRAVA_CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
STRAVA_REDIRECT_URI = os.getenv("STRAVA_REDIRECT_URI")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Support multiple origins: FRONTEND_URL + always allow localhost for local dev
_origins = {FRONTEND_URL, "http://localhost:5173", "http://localhost:5174"}
ALLOWED_ORIGINS = list(_origins)

app = FastAPI(title="Quinnya API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Hello from Quinnya backend"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/auth/strava")
def strava_login():
    _cleanup_pending()
    state = str(uuid.uuid4())
    _pending_states[state] = time.time() + _PENDING_TTL
    url = (
        f"https://www.strava.com/oauth/authorize"
        f"?client_id={STRAVA_CLIENT_ID}"
        f"&redirect_uri={STRAVA_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=read,activity:read_all"
        f"&state={state}"
    )
    return RedirectResponse(url)


@app.get("/auth/callback")
async def strava_callback(code: str, state: str, db: Session = Depends(get_db)):
    expiry = _pending_states.pop(state, None)
    if expiry is None or time.time() > expiry:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id": STRAVA_CLIENT_ID,
                "client_secret": STRAVA_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
            },
        )

    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Помилка авторизації Strava")

    tokens = response.json()
    strava_athlete = tokens["athlete"]

    # Зберігаємо або оновлюємо атлета в БД
    athlete = db.query(models.Athlete).filter_by(strava_id=strava_athlete["id"]).first()
    new_session_token = str(uuid.uuid4())
    if athlete:
        athlete.access_token = tokens["access_token"]
        athlete.refresh_token = tokens["refresh_token"]
        athlete.token_expires_at = tokens.get("expires_at", 0)
        athlete.session_token = new_session_token
    else:
        athlete = models.Athlete(
            strava_id=strava_athlete["id"],
            firstname=strava_athlete.get("firstname", ""),
            lastname=strava_athlete.get("lastname", ""),
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            token_expires_at=tokens.get("expires_at", 0),
            session_token=new_session_token,
        )
        db.add(athlete)

    db.commit()

    athlete_name = strava_athlete.get("firstname", "")
    _cleanup_pending()
    if len(_pending_sessions) >= _MAX_PENDING:
        raise HTTPException(status_code=503, detail="Too many pending sessions")
    session_id = str(uuid.uuid4())
    _pending_sessions[session_id] = {
        "session_token": new_session_token,
        "athlete_name": athlete_name,
        "expires_at": time.time() + _PENDING_TTL,
    }
    return RedirectResponse(f"{FRONTEND_URL}?session_id={session_id}")


@app.get("/auth/token")
def exchange_session(session_id: str):
    session = _pending_sessions.pop(session_id, None)
    if not session or time.time() > session["expires_at"]:
        raise HTTPException(status_code=404, detail="Invalid or expired session")
    return {"session_token": session["session_token"], "athlete_name": session["athlete_name"]}


def _get_athlete(authorization: str = Header(), db: Session = Depends(get_db)) -> models.Athlete:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    session_token = authorization.removeprefix("Bearer ")
    athlete = db.query(models.Athlete).filter_by(session_token=session_token).first()
    if not athlete:
        raise HTTPException(status_code=401, detail="Invalid session")
    return athlete


async def _ensure_fresh_token(athlete: models.Athlete, db: Session) -> str:
    """Return a valid Strava access_token, refreshing if it expires within 60 s."""
    if athlete.token_expires_at and time.time() < athlete.token_expires_at - 60:
        return athlete.access_token

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id": STRAVA_CLIENT_ID,
                "client_secret": STRAVA_CLIENT_SECRET,
                "grant_type": "refresh_token",
                "refresh_token": athlete.refresh_token,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Strava token refresh failed — please log in again")

    data = resp.json()
    athlete.access_token = data["access_token"]
    athlete.refresh_token = data["refresh_token"]
    athlete.token_expires_at = data["expires_at"]
    db.commit()
    return athlete.access_token


@app.post("/auth/logout")
def logout(db: Session = Depends(get_db), athlete: models.Athlete = Depends(_get_athlete)):
    athlete.session_token = None
    db.commit()
    return {"ok": True}


@app.get("/activities/cached")
def get_cached_activities(db: Session = Depends(get_db), athlete: models.Athlete = Depends(_get_athlete)):
    rows = (
        db.query(models.Activity)
        .filter_by(athlete_id=athlete.id)
        .order_by(models.Activity.start_date_local.desc())
        .all()
    )

    return [
        {
            "id": a.strava_id,
            "name": a.name,
            "type": a.type,
            "distance": a.distance,
            "moving_time": a.moving_time,
            "start_date_local": a.start_date_local.isoformat(),
        }
        for a in rows
    ]


@app.get("/activities")
async def get_activities(
    page: int = Query(1, ge=1, le=100),
    after: int | None = None,
    before: int | None = None,
    per_page: int = 30,
    db: Session = Depends(get_db),
    athlete: models.Athlete = Depends(_get_athlete),
):
    strava_token = await _ensure_fresh_token(athlete, db)

    strava_params: dict = {"per_page": min(per_page, 200), "page": page}
    if after is not None:
        strava_params["after"] = after
    if before is not None:
        strava_params["before"] = before

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://www.strava.com/api/v3/athlete/activities",
            headers={"Authorization": f"Bearer {strava_token}"},
            params=strava_params,
        )

    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch activities")

    strava_activities = response.json()

    for a in strava_activities:
        exists = db.query(models.Activity).filter_by(strava_id=a["id"]).first()
        if not exists:
            db.add(models.Activity(
                strava_id=a["id"],
                athlete_id=athlete.id,
                name=a["name"],
                type=a["type"],
                distance=a["distance"],
                moving_time=a["moving_time"],
                start_date_local=datetime.fromisoformat(a["start_date_local"]),
            ))

    db.commit()

    return strava_activities


@app.get("/activitydetails")
async def get_activity_detail(id: int, db: Session = Depends(get_db), athlete: models.Athlete = Depends(_get_athlete)):
    activity_id = id
    strava_token = await _ensure_fresh_token(athlete, db)

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://www.strava.com/api/v3/activities/{activity_id}",
            headers={"Authorization": f"Bearer {strava_token}"},
        )

    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch activity details")

    return response.json()


@app.get("/activities/{activity_id}/gpx")
async def download_gpx(activity_id: int, db: Session = Depends(get_db), athlete: models.Athlete = Depends(_get_athlete)):
    strava_token = await _ensure_fresh_token(athlete, db)

    async with httpx.AsyncClient() as client:
        detail_resp, streams_resp = await asyncio.gather(
            client.get(
                f"https://www.strava.com/api/v3/activities/{activity_id}",
                headers={"Authorization": f"Bearer {strava_token}"},
            ),
            client.get(
                f"https://www.strava.com/api/v3/activities/{activity_id}/streams",
                headers={"Authorization": f"Bearer {strava_token}"},
                params={"keys": "latlng,time,altitude", "key_by_type": "true"},
            ),
        )

    if detail_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch activity details")

    detail = detail_resp.json()
    streams = streams_resp.json() if streams_resp.status_code == 200 else {}

    name = detail.get("name", f"Activity {activity_id}")
    start_time_str = detail.get("start_date", "")

    latlng_data = streams.get("latlng", {}).get("data", [])
    time_data = streams.get("time", {}).get("data", [])
    altitude_data = streams.get("altitude", {}).get("data", [])

    if not latlng_data:
        raise HTTPException(status_code=404, detail="No GPS data available for this activity")

    try:
        start_dt = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))
    except Exception:
        start_dt = datetime.now(timezone.utc)

    gpx_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="Quinnya" xmlns="http://www.topografix.com/GPX/1/1">',
        f'  <trk><name>{name}</name><trkseg>',
    ]

    for i, (lat, lng) in enumerate(latlng_data):
        ele = altitude_data[i] if i < len(altitude_data) else None
        t_offset = time_data[i] if i < len(time_data) else i
        pt_time = start_dt + timedelta(seconds=t_offset)
        ele_tag = f"<ele>{ele:.1f}</ele>" if ele is not None else ""
        time_tag = f"<time>{pt_time.strftime('%Y-%m-%dT%H:%M:%SZ')}</time>"
        gpx_lines.append(f'    <trkpt lat="{lat:.7f}" lon="{lng:.7f}">{ele_tag}{time_tag}</trkpt>')

    gpx_lines.extend(['  </trkseg></trk>', '</gpx>'])

    safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in name).strip()
    filename = f"{safe_name}.gpx"

    return Response(
        content="\n".join(gpx_lines),
        media_type="application/gpx+xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
