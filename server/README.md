# Serveur Node.js pour le Scraping Forex

Ce serveur Node.js/Express remplace les Supabase Edge Functions pour exécuter Playwright avec les binaires Chromium complets.

## Installation

Les dépendances sont déjà installées dans le projet principal. Si nécessaire :

```bash
npm install
```

## Démarrage

### Mode développement (avec watch)
```bash
npm run dev:server
```

### Mode production
```bash
npm run server
```

Le serveur démarre sur `http://localhost:3001` par défaut.

## Configuration

Vous pouvez configurer le port via la variable d'environnement `PORT` :

```bash
PORT=3001 npm run server
```

## Routes API

- `POST /api/scrape-forex-options` - Scrape les options forex
- `POST /api/scrape-forex-prices` - Scrape les prix des futures
- `POST /api/scrape-forex-symbols` - Scrape les symboles forex
- `POST /api/scrape-all-forex` - Scrape toutes les données forex
- `GET /health` - Health check

## Frontend

Le frontend est configuré pour utiliser `http://localhost:3001/api` par défaut. Vous pouvez changer cela via la variable d'environnement `VITE_API_URL` dans un fichier `.env` :

```
VITE_API_URL=http://localhost:3001/api
```

## Avantages

- ✅ Playwright fonctionne avec les binaires Chromium complets
- ✅ Pas de limitations des Supabase Edge Functions
- ✅ Meilleure performance pour le scraping JavaScript
- ✅ Contrôle total sur l'environnement d'exécution
