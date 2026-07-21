.RECIPEPREFIX := >
.PHONY: install-app install-backend lint build test start

install-app:
> npm install

install-backend:
> cd server && npm install

lint:
> npm run lint --if-present

build:
> export ANDROID_HOME=$${ANDROID_HOME:-/data/data/com.termux/files/home/android-sdk} && \
  if [ -d "/data/data/com.termux/files/usr/lib/jvm/java-17-openjdk" ]; then \
    export JAVA_HOME=/data/data/com.termux/files/usr/lib/jvm/java-17-openjdk; \
  fi && \
  node node_modules/expo/bin/cli prebuild --platform android && \
  cd android && ./gradlew assembleDebug && \
  cp app/build/outputs/apk/debug/app-debug.apk ../

test:
> echo "No backend tests configured yet"

start:
> node server/index.js & npm start
