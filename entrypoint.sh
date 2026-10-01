#!/bin/sh
# entrypoint.sh
set -e

if [ -d "/app/vaniasession" ] && [ ! -w "/app/vaniasession" ]; then
  echo "⚠️  Corrigiendo permisos de vaniasession..."
fi

exec "$@"