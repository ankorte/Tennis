# Tennis Turnier Manager - Deployment Guide

## Lokale Entwicklung

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Datenbank initialisieren
npm run db:push

# 3. Seed-Daten einspielen (optional)
npm run db:seed

# 4. Entwicklungsserver starten
npm run dev
```

Öffnen Sie http://localhost:3000 im Browser.

**Admin-Zugangsdaten:**
- E-Mail: admin@tennis.de
- Passwort: admin123

---

## Docker Deployment

### Build & Start

```bash
# Image bauen
docker build -t tennis-turnier .

# Container starten (mit persistentem Datenbankvolume)
docker run -d \
  -p 3000:3000 \
  -v tennis-data:/app/data \
  -e JWT_SECRET="ihr-geheimes-passwort-hier" \
  --name tennis-turnier \
  tennis-turnier
```

### Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - tennis-data:/app/data
    environment:
      - JWT_SECRET=ihr-geheimes-passwort-hier
      - DATABASE_URL=file:/app/data/tennis.db
    restart: unless-stopped

volumes:
  tennis-data:
```

---

## Azure App Service Deployment

### Voraussetzungen
- Azure CLI installiert
- Azure-Konto mit aktiver Subscription

### Schritt 1: Azure Container Registry erstellen

```bash
# Resource Group erstellen
az group create --name tennis-turnier-rg --location germanywestcentral

# Container Registry erstellen
az acr create \
  --resource-group tennis-turnier-rg \
  --name tennisturnierregistry \
  --sku Basic

# Login
az acr login --name tennisturnierregistry
```

### Schritt 2: Docker Image pushen

```bash
# Image taggen
docker tag tennis-turnier tennisturnierregistry.azurecr.io/tennis-turnier:latest

# Image pushen
docker push tennisturnierregistry.azurecr.io/tennis-turnier:latest
```

### Schritt 3: App Service erstellen

```bash
# App Service Plan erstellen (Linux)
az appservice plan create \
  --name tennis-turnier-plan \
  --resource-group tennis-turnier-rg \
  --is-linux \
  --sku B1

# Web App erstellen
az webapp create \
  --resource-group tennis-turnier-rg \
  --plan tennis-turnier-plan \
  --name tennis-turnier-app \
  --deployment-container-image-name tennisturnierregistry.azurecr.io/tennis-turnier:latest
```

### Schritt 4: Umgebungsvariablen setzen

```bash
az webapp config appsettings set \
  --resource-group tennis-turnier-rg \
  --name tennis-turnier-app \
  --settings \
    JWT_SECRET="ihr-sehr-geheimes-passwort-2025" \
    DATABASE_URL="file:/app/data/tennis.db" \
    NEXTAUTH_URL="https://tennis-turnier-app.azurewebsites.net"
```

### Schritt 5: Persistenten Speicher konfigurieren

```bash
# Storage Account erstellen
az storage account create \
  --name tennisturnierdata \
  --resource-group tennis-turnier-rg \
  --sku Standard_LRS

# Storage Share erstellen
az storage share create \
  --account-name tennisturnierdata \
  --name tennis-db

# Storage-Key abrufen
STORAGE_KEY=$(az storage account keys list \
  --account-name tennisturnierdata \
  --resource-group tennis-turnier-rg \
  --query '[0].value' -o tsv)

# App Service mit Storage verbinden
az webapp config storage-account add \
  --resource-group tennis-turnier-rg \
  --name tennis-turnier-app \
  --custom-id tennis-data \
  --storage-type AzureFiles \
  --account-name tennisturnierdata \
  --share-name tennis-db \
  --access-key $STORAGE_KEY \
  --mount-path /app/data
```

---

## Umgebungsvariablen

| Variable | Beschreibung | Beispiel |
|----------|--------------|---------|
| `DATABASE_URL` | SQLite-Datenbankpfad | `file:./dev.db` |
| `JWT_SECRET` | Geheimer Schlüssel für JWT-Tokens | Langer zufälliger String |
| `NEXTAUTH_URL` | Basis-URL der Anwendung | `https://ihre-domain.de` |

### JWT_SECRET generieren

```bash
# Linux/Mac
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Produktionsdatenbank (Azure SQL)

Für Produktionsumgebungen empfehlen wir den Wechsel zu Azure SQL:

### 1. Prisma-Schema anpassen

```prisma
datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}
```

### 2. Azure SQL erstellen

```bash
az sql server create \
  --name tennis-turnier-sql \
  --resource-group tennis-turnier-rg \
  --location germanywestcentral \
  --admin-user sqladmin \
  --admin-password "IhrPasswort123!"

az sql db create \
  --resource-group tennis-turnier-rg \
  --server tennis-turnier-sql \
  --name tennis-turnier \
  --edition Basic
```

---

## SSL/Domain

### Azure App Service Domain

```bash
# Custom Domain hinzufügen
az webapp config hostname add \
  --webapp-name tennis-turnier-app \
  --resource-group tennis-turnier-rg \
  --hostname www.ihr-domain.de

# SSL-Zertifikat (kostenlos von App Service)
az webapp config ssl bind \
  --name tennis-turnier-app \
  --resource-group tennis-turnier-rg \
  --certificate-thumbprint [THUMBPRINT] \
  --ssl-type SNI
```

---

## Wartung

```bash
# Logs anzeigen
az webapp log tail --name tennis-turnier-app --resource-group tennis-turnier-rg

# App neustarten
az webapp restart --name tennis-turnier-app --resource-group tennis-turnier-rg

# Deployment-Status prüfen
az webapp show --name tennis-turnier-app --resource-group tennis-turnier-rg
```
