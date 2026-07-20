.RECIPEPREFIX := >
.PHONY: install-app install-backend lint build test start

install-app:
> npm install

install-backend:
> cd server && npm install

lint:
> npm run lint --if-present

build:
> npx expo export --platform web

test:
> echo "No backend tests configured yet"

start:
> node server/index.js & npm start
