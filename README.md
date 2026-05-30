<div align="center">

<img src="quinnya_icon.svg" alt="Quinnya logo" width="120" />

# Quinnya

**Your personal sport tracker for running & cycling.**

Connect your Strava account and turn your activities into a clean dashboard with progress charts, route maps, and goals.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#-license)

</div>

---

## ✨ What is Quinnya?

Quinnya is a self-hosted web app that pulls your activities from **[Strava](https://www.strava.com/)** and presents them in a focused, personal way. Instead of digging through Strava's feed, you get your own dashboard built around the metrics that matter to you: total distance, pace, time, and progress toward your goals.

It's built for athletes who run, cycle, or both — and for anyone who wants to own and customize the way their training data is displayed.

> Garmin and other devices are supported automatically, as long as they sync to Strava.

## 🚀 Features

- **🔐 Strava login** — secure OAuth 2.0 sign-in, no passwords to manage.
- **📋 Activity list** — browse all your runs and rides, with infinite scroll and date-range filtering.
- **📊 Dashboard** — at-a-glance totals and stats, filterable by month and year.
- **🗺️ Route maps** — view the GPS track of each activity on an interactive map (powered by Leaflet).
- **📈 Progress** — visualize how your training trends over time.
- **🎯 Goals** — set targets and track your progress against them.
- **💾 Local caching** — activities are stored in a local database, so the app stays fast and works without re-fetching everything from Strava on each visit.

## 🛠️ Tech Stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Leaflet |
| **Backend** | FastAPI, SQLAlchemy, SQLite |
| **Data source** | Strava API (OAuth 2.0) |

## 📦 Project Structure

```
sport-app/
├── backend/        # FastAPI server — Strava OAuth, activity sync, REST API
│   ├── main.py         # API routes
│   ├── models.py       # Database models (Athlete, Activity)
│   ├── database.py     # DB connection
│   └── requirements.txt
└── quinnya/        # React + TypeScript frontend
    ├── src/
    │   ├── App.tsx
    │   └── components/ # Dashboard, Activities, ActivityDetail, Progress, Goals
    └── package.json
```

## ⚡ Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- A free **[Strava API application](https://www.strava.com/settings/api)** to get your Client ID and Client Secret

### 1. Clone the repository

```bash
git clone https://github.com/quinnyaa/sport-app.git
cd sport-app
```

### 2. Set up the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# then edit .env with your Strava credentials
```

Your `backend/.env` should look like:

```env
STRAVA_CLIENT_ID=your_client_id_here
STRAVA_CLIENT_SECRET=your_client_secret_here
STRAVA_REDIRECT_URI=http://localhost:8000/auth/callback
FRONTEND_URL=http://localhost:5173
```

Run the server:

```bash
uvicorn main:app --reload
```

The API will be available at **http://localhost:8000** (interactive docs at `/docs`).

### 3. Set up the frontend

```bash
cd quinnya
npm install

# Configure environment variables
cp .env.example .env
```

Your `quinnya/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_BASE_URL=/
```

Run the dev server:

```bash
npm run dev
```

Open **http://localhost:5173** and click **Connect Strava** to log in. 🎉

> **Strava setup note:** In your Strava API application settings, set the *Authorization Callback Domain* to `localhost`.

## 🔌 API Overview

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/auth/strava` | Start the Strava OAuth login flow |
| `GET` | `/auth/callback` | OAuth redirect target (handled automatically) |
| `GET` | `/activities` | Fetch activities from Strava (with pagination & date filters) |
| `GET` | `/activities/cached` | Return activities stored in the local database |
| `GET` | `/activities/{id}` | Fetch full details for a single activity |
| `GET` | `/health` | Health check |

## 🗺️ Roadmap

- [x] Strava OAuth login & activity sync
- [x] Dashboard with monthly/yearly stats
- [x] Activity detail view with route map
- [ ] Richer progress charts (pace, heart rate, elevation)
- [ ] Running vs. cycling comparison
- [ ] Training volume planning

## 🤝 Contributing

Contributions, ideas, and bug reports are welcome! Feel free to open an issue or submit a pull request.

## 📄 License

Released under the [MIT License](LICENSE). You're free to use, modify, and share it.

---

<div align="center">
Made with ❤️ for athletes who love their data.
</div>
