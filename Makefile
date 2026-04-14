.RECIPEPREFIX := >
.PHONY: install-frontend install-backend lint build test

install-frontend:
> cd frontend && npm install

install-backend:
> cd backend && python3 -m venv .venv && ./.venv/bin/pip install -r requirements-dev.txt

lint:
> cd frontend && npm run lint

build:
> cd frontend && npm run build

test:
> cd backend && . .venv/bin/activate && python -m pytest -q
