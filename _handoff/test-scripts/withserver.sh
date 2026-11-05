#!/bin/bash
# Starts the preview server, runs one node script, stops the server.
cd /home/user/simdesk-life
npx vite preview --port 4173 --strictPort > /tmp/claude-0/-home-user/ae662db6-75b9-5ed0-9961-263b07438100/scratchpad/prev.log 2>&1 &
PID=$!
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:4173/ && break; sleep 0.3; done
cd /tmp/claude-0/-home-user/ae662db6-75b9-5ed0-9961-263b07438100/scratchpad
node "$@"
CODE=$?
kill $PID 2>/dev/null; pkill -P $PID 2>/dev/null
exit $CODE
