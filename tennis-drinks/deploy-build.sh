#!/bin/bash
# Dieses Script wird von Azure WAEHREND der Deployment-Phase ausgefuehrt.
# Ausgeloest durch SCM_DO_BUILD_DURING_DEPLOYMENT=true + .deployment

SOURCE="${DEPLOYMENT_SOURCE:-$(pwd)}"
TARGET="${DEPLOYMENT_TARGET:-/home/site/wwwroot}"

echo "=== TV Bruvi - Deployment Build ==="
echo "Source: $SOURCE"
echo "Target: $TARGET"
echo "Node: $(node -v)"

# Dateien via tar von Source nach Target kopieren
echo ""
echo "--- Kopiere Dateien nach wwwroot (tar) ---"
(cd "$SOURCE" && tar cf - .) | (cd "$TARGET" && tar xf -)
echo "--- Kopieren abgeschlossen ---"

# Backend-Abhaengigkeiten installieren
cd "$TARGET"
echo ""
echo "--- npm install (backend) ---"
npm --prefix backend install --omit=dev 2>&1
echo "--- npm install abgeschlossen ---"

echo ""
echo "=== Deployment Build fertig ==="
