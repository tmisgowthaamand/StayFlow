#!/usr/bin/env bash
# exit on error
set -o errexit

npm install
# Install Chrome dependencies for whatsapp-web.js (Puppeteer)
# Note: Render's native environment might already have some, but we ensure others here if possible.
# Most of the time on Render, you just need these env vars:
# PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
