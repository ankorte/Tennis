#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export NODE_ENV=production

echo "=== TV Bruvi - Startup ==="
echo "Verzeichnis: $SCRIPT_DIR"
echo "Node: $(node -v)"
echo "npm:  $(npm -v)"
echo "NODE_ENV: $NODE_ENV"
echo "DB_PATH: ${DB_PATH:-nicht gesetzt}"
echo ""

# Verzeichnisstruktur anzeigen (Debugging)
echo "--- Dateien ---"
ls -la
echo ""
echo "--- backend/ ---"
ls -la backend/ 2>/dev/null || echo "  FEHLER: backend/ nicht gefunden!"
echo ""

# Version aus package.json lesen
CURRENT_VERSION=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown")
BUILT_VERSION=""
if [ -f "backend/dist/.version" ]; then
    BUILT_VERSION=$(cat backend/dist/.version)
fi

echo "Aktuelle Version: $CURRENT_VERSION"
echo "Gebaute Version:  $BUILT_VERSION"

# Backend neu bauen wenn: dist fehlt ODER Version sich geaendert hat
if [ ! -f "backend/dist/index.js" ] || [ "$CURRENT_VERSION" != "$BUILT_VERSION" ]; then
    echo ""
    echo "--- Backend-Build gestartet (v${CURRENT_VERSION}) ---"

    # Altes dist entfernen um sauberen Build zu gewaehrleisten
    if [ -d "backend/dist" ]; then
        echo ">>> Entferne altes backend/dist/"
        rm -rf backend/dist
    fi

    echo ">>> Backend: npm install"
    npm --prefix backend install --production=false 2>&1
    echo ">>> Backend: tsc"
    npm --prefix backend run build 2>&1

    # Version merken damit beim naechsten Start nicht erneut gebaut wird
    echo "$CURRENT_VERSION" > backend/dist/.version
    echo "--- Backend-Build abgeschlossen ---"
else
    echo "--- Backend bereits aktuell (v${BUILT_VERSION}), ueberspringe ---"
fi

# Pruefen ob Build erfolgreich war
if [ ! -f "backend/dist/index.js" ]; then
    echo "FEHLER: backend/dist/index.js existiert nicht nach Build!"
    echo "--- backend/dist/ Inhalt ---"
    ls -la backend/dist/ 2>/dev/null || echo "  Verzeichnis existiert nicht"
    exit 1
fi

# Pruefen ob frontend/dist existiert
if [ ! -f "frontend/dist/index.html" ]; then
    echo "WARNUNG: frontend/dist/index.html nicht gefunden!"
    echo "--- frontend/ ---"
    ls -la frontend/ 2>/dev/null || echo "  frontend/ nicht gefunden"
    ls -la frontend/dist/ 2>/dev/null || echo "  frontend/dist/ nicht gefunden"
fi

# Datenbank-Verzeichnis sicherstellen
DB_DIR=$(dirname "${DB_PATH:-./data/tennis.db}")
if [ ! -d "$DB_DIR" ]; then
    echo "Erstelle DB-Verzeichnis: $DB_DIR"
    mkdir -p "$DB_DIR"
fi

echo ""
echo "=== Starte Server v${CURRENT_VERSION} ==="
exec node backend/dist/index.js
