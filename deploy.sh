#!/bin/bash

# LigPlot3D Deployment Script

# Stop on error
set -e

echo "========================================"
echo "🚀 Starting LigPlot3D Deployment"
echo "========================================"

# 1. Check if we are in the correct directory (Look for package.json)
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found!"
    echo "Please run this script from the root of the project (LigDockAnalyzer/)."
    exit 1
fi

# 2. Install Dependencies (Fast check)
echo "📦 Checking/Installing dependencies..."
npm install

# 3. Build the project
echo "🔨 Building project..."
# This runs 'tsc -b && vite build' via package.json
npm run build

# 4. Deploy to GitHub Pages
echo "📤 Deploying to GitHub Pages..."
# This runs 'gh-pages -d dist' via package.json
npm run deploy

echo "========================================"
echo "✅ Deployment Success!"
echo "🌍 App is live at: https://singhnitink.github.io/LigPlot3D/"
echo "========================================"
