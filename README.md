# Oroborous

Native Expo mobile app paired with a FastAPI backend.

## Stack

- **Mobile**: Expo + React Native
- **Backend**: FastAPI (Python)

## Project layout

- `/` — Expo project entry (App.js, app.json)
- `/backend` — FastAPI service

## Run the mobile app

```bash
npm install
npm start
# press `w` for web, or scan the QR code with Expo Go
```

## Run the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health endpoint: `GET http://127.0.0.1:8000/api/v1/health`

## Make targets

- `make install-app` — install Expo dependencies
- `make start` — start the Expo dev server
- `make test` — run backend tests
- `make install-backend` — set up backend virtualenv
