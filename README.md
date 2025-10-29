# Supernovia Scraper Service

Service de scraping dédié pour Supernovia avec Playwright.
Déployé sur Railway pour supporter Playwright en production.

## Routes API

### POST /scrape
Scrape une URL avec login optionnel.

**Body:**
```json
{
  "url": "https://www.lexis360intelligence.fr/...",
  "database": "lexisnexis",
  "credentials": {
    "username": "user@example.com",
    "password": "password"
  }
}
```

**Response:**
```json
{
  "success": true,
  "content": "Contenu extrait...",
  "extractedAt": "2025-10-29T..."
}
```

## Databases supportées

- `lexisnexis` - OAuth2 login
- `dalloz` - 2-step login
- `doctrine` - 2-step login
- `lamyline` - 1-step login
- `linkedin` - Login + 2FA support

## Deploy sur Railway

1. Créer un projet Railway
2. Connecter ce repo Git
3. Railway détecte automatiquement le Dockerfile
4. Deploy !

## Local

```bash
npm install
npm start
```

Service disponible sur http://localhost:3030
