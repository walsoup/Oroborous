# Oroborous

Full-stack starter stack using:

- **Frontend**: Next.js (App Router) + Tailwind CSS
- **Backend**: FastAPI (Python, async routes with strict type hints)

## Repository structure

- `/frontend` — Next.js frontend
- `/backend` — FastAPI backend

## Run locally

### 1) Backend (FastAPI)

From the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health endpoint:

- `GET http://127.0.0.1:8000/api/v1/health`

### 2) Frontend (Next.js)

From the repository root:

```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

Open `http://127.0.0.1:3000`.

## Validation commands

From repo root:

```bash
make lint
make build
make test
```
