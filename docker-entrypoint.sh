#!/bin/sh
set -e

# Uploads persistentes dentro del volumen /data
mkdir -p /data/uploads
rm -rf /app/public/uploads
ln -sfn /data/uploads /app/public/uploads

# Migraciones automáticas al arrancar
node_modules/.bin/prisma migrate deploy

exec node server.js
