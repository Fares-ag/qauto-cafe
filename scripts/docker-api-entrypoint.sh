#!/bin/sh
set -e

missing=""
for var in DATABASE_URL DIRECT_URL JWT_ACCESS_SECRET JWT_REFRESH_SECRET TERMINAL_ENROLLMENT_SECRET CORS_ORIGIN; do
  eval "val=\$$var"
  if [ -z "$val" ]; then
    missing="$missing $var"
  fi
done

if [ -n "$missing" ]; then
  echo "ERROR: Required environment variables are not set:$missing"
  echo "Add them in Vercel project settings (see deploy/vercel.env.example)."
  exit 1
fi

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Starting API..."
mkdir -p uploads/menu
exec node apps/api/dist/main.js
