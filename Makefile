.RECIPEPREFIX := >
.PHONY: install-app install-backend lint build test start

install-app:
> npm install

install-backend:
> cd backend && python3 -m venv .venv && ./.venv/bin/pip install -r requirements-dev.txt

lint:
> npm run lint --if-present

build:
> npx expo export --platform web

test:
> cd backend && . .venv/bin/activate && python -m pytest -q

start:
> npm start
