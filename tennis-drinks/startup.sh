#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export NODE_ENV=production

CURRENT_VERSION=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown")
echo "=== TV Bruvi v${CURRENT_VERSION} - Startup ==="
echo "DB_PATH: ${DB_PATH:-nicht gesetzt}"

# Sicherstellen dass dist vorhanden ist
if [ ! -f "backend/dist/index.js" ]; then
    echo "FEHLER: backend/dist/index.js nicht gefunden!"
    exit 1
fi

# node_modules pruefen (sollte von deploy-build.sh installiert worden sein)
if [ ! -d "backend/node_modules" ]; then
    echo "WARNUNG: backend/node_modules fehlt – starte Notfall-Install..."
    npm --prefix backend install --omit=dev 2>&1
    echo "Notfall-Install abgeschlossen"
fi

# Datenbank-Verzeichnis sicherstellen
DB_DIR=$(dirname "${DB_PATH:-/home/data/tennis.db}")
if [ ! -d "$DB_DIR" ]; then
    echo "Erstelle DB-Verzeichnis: $DB_DIR"
    mkdir -p "$DB_DIR"
fi

echo "=== Starte Server ==="
exec node backend/dist/index.js
