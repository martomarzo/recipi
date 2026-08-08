#!/bin/sh
set -e

# Uploads persistentes dentro del volumen /data (servidos por la app
# vía /uploads/[name], no como estáticos de public/)
mkdir -p /data/uploads

# Migraciones automáticas al arrancar
node_modules/.bin/prisma migrate deploy

# Next standalone bindea al env HOSTNAME (el shell lo setea al hostname del
# contenedor → solo eth0). Forzar 0.0.0.0 para que loopback también escuche
# (tailscale serve proxya a 127.0.0.1:3000).
export HOSTNAME=0.0.0.0

exec node server.js
