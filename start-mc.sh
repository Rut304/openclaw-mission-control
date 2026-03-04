#!/bin/bash
# Mission Control startup script
# Used by launchd to start the Next.js production server

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export HOME="/Users/rutroh"
export NODE_ENV="production"

cd /Users/rutroh/openclaw-mission-control

# Kill any orphaned MC processes on port 3001
lsof -ti :3001 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1

# Start OpenClaw Gateway (required for MC to show ONLINE)
if ! lsof -ti :18789 >/dev/null 2>&1; then
  /opt/homebrew/bin/openclaw gateway --port 18789 &
  sleep 2
fi

# Start Next.js production server (pre-built, much faster than dev)
exec /opt/homebrew/bin/npx next start -p 3001
