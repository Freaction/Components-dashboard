@echo off
title Components Dashboard Dev

:: Clean up old processes to avoid port conflicts
echo 🔍 Cleaning up...
call node scripts/cleanup.js

:: Ensure dependencies are installed if someone just cloned the repo
if not exist node_modules (
    echo 📦 Installing dependencies...
    call npm install
)

:: Start both API and Web apps
echo 🚀 Starting services...
call npm run dev
