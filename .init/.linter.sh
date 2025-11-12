#!/bin/bash
cd /home/kavia/workspace/code-generation/dream-sky-adventure-222321-222345/dream_dash_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

