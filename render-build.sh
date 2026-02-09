#!/usr/bin/env bash
# exit on error
set -o errexit

npm install
# Build the dashboard
cd dashboard && npm install && npm run build
cd ..

# Install Chrome dependencies for whatsapp-web.js (Puppeteer)
# Note: Render handles this if you use the right environment, but we ensure build completion here.
