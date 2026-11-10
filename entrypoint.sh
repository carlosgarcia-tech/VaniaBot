#!/bin/sh
# entrypoint.sh
set -e

if [ -d "/app/orbitsession" ] && [ ! -w "/app/orbitsession" ]; then
  echo "⚠️  Fixing orbitsession permissions..."
fi

exec "$@"