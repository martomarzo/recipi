#!/bin/sh
set -e

# Uploads persistentes dentro del volumen /data (servidos por la app
# vía /uploads/[name], no como estáticos de public/)
mkdir -p /data/uploads

# Migraciones automáticas al arrancar
node_modules/.bin/prisma migrate deploy

exec node server.js
