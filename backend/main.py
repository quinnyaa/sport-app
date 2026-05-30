import os
from datetime import datetime
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from sqlalchemy.orm import Session
import httpx

from database import engine, get_db, Base
import models

load_dotenv()

Base.metadata.create_all(bind=engine)

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
    url = (
        f"https://www.strava.com/oauth/authorize"
        f"?client_id={STRAVA_CLIENT_ID}"
        f"&redirect_uri={STRAVA_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=read,activity:read_all"
    )
    return RedirectResponse(url)


@app.get("/auth/callback")
async def strava_callback(code: str, db: Session = Depends(get_db)):
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
    if athlete:
        athlete.access_token = tokens["access_token"]
        athlete.refresh_token = tokens["refresh_token"]
    else:
        athlete = models.Athlete(
            strava_id=strava_athlete["id"],
            firstname=strava_athlete.get("firstname", ""),
            lastname=strava_athlete.get("lastname", ""),
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
        )
        db.add(athlete)

    db.commit()

    athlete_name = strava_athlete.get("firstname", "")
    frontend_url = (
        f"{FRONTEND_URL}"
        f"?access_token={tokens['access_token']}"
        f"&athlete_name={athlete_name}"
    )
    return RedirectResponse(frontend_url)


@app.get("/activities/cached")
def get_cached_activities(access_token: str, db: Session = Depends(get_db)):
    athlete = db.query(models.Athlete).filter_by(access_token=access_token).first()
    if not athlete:
        raise HTTPException(status_code=401, detail="Unknown token")

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
async def get_activities(access_token: str, page: int = 1, db: Session = Depends(get_db)):
    athlete = db.query(models.Athlete).filter_by(access_token=access_token).first()
    if not athlete:
        raise HTTPException(status_code=401, detail="Unknown token")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://www.strava.com/api/v3/athlete/activities",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"per_page": 30, "page": page},
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


@app.get("/activities/{activity_id}")
async def get_activity_detail(activity_id: int, access_token: str, db: Session = Depends(get_db)):
    athlete = db.query(models.Athlete).filter_by(access_token=access_token).first()
    if not athlete:
        raise HTTPException(status_code=401, detail="Unknown token")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://www.strava.com/api/v3/activities/{activity_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch activity details")

    return response.json()
