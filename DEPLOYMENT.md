# Guide de Déploiement

## Problème : Railway utilise Bun au lieu de npm

Si vous obtenez l'erreur `error: lockfile had changes, but lockfile is frozen`, c'est parce que Railway détecte automatiquement Bun et essaie de l'utiliser.

## Solution : Configuration Railway pour utiliser npm

Les fichiers suivants ont été créés pour forcer Railway à utiliser npm :

- `nixpacks.toml` - Configuration Nixpacks pour Railway
- `railway.json` - Configuration Railway
- `Procfile` - Fichier Procfile pour le démarrage

## Étapes de déploiement sur Railway

### 1. Créer un projet Railway

1. Allez sur [Railway](https://railway.app)
2. Créez un nouveau projet
3. Connectez votre repository GitHub

### 2. Configurer le service

Railway devrait automatiquement détecter que c'est un projet Node.js. Si ce n'est pas le cas :

1. Cliquez sur **"New"** → **"GitHub Repo"**
2. Sélectionnez votre repository
3. Railway détectera automatiquement le `package.json`

### 3. Configurer les variables d'environnement

Dans les paramètres du service Railway, ajoutez :

- **PORT** : Railway définit automatiquement cette variable, mais vous pouvez la laisser vide
- Aucune autre variable n'est nécessaire pour le serveur

### 4. Configurer le Root Directory (si nécessaire)

Si Railway ne détecte pas correctement le projet :

1. Allez dans **Settings** → **Service**
2. Définissez **Root Directory** : `/` (racine du projet)

### 5. Configurer le Start Command

Railway devrait automatiquement utiliser `npm run server` grâce au `Procfile` et `railway.json`.

Si ce n'est pas le cas, dans **Settings** → **Deploy**, définissez :

- **Start Command** : `npm run server`

### 6. Installer Playwright

Railway doit installer les binaires Chromium de Playwright. Ajoutez cette commande dans **Settings** → **Build** :

**Build Command** (optionnel, Railway devrait le faire automatiquement) :
```bash
npm ci && npx playwright install chromium
```

Ou ajoutez un script dans `package.json` (voir ci-dessous).

### 7. Vérifier le déploiement

Une fois déployé, Railway vous donnera une URL comme :
```
https://votre-projet.up.railway.app
```

Testez l'endpoint de santé :
```
https://votre-projet.up.railway.app/health
```

## Configuration du Frontend Vercel

Après avoir déployé le serveur sur Railway :

1. Allez dans votre projet Vercel → **Settings** → **Environment Variables**
2. Ajoutez :
   - **Name** : `VITE_API_URL`
   - **Value** : `https://votre-projet.up.railway.app/api`
   - **Environments** : Production, Preview, Development
3. Redéployez votre application Vercel

## Alternative : Supprimer bun.lockb

Si vous n'utilisez pas Bun, vous pouvez supprimer `bun.lockb` du repository :

```bash
git rm bun.lockb
git commit -m "Remove bun.lockb to use npm"
git push
```

Cela empêchera Railway de détecter Bun.

## Dépannage

### Erreur : "lockfile had changes, but lockfile is frozen"

**Solution** : Les fichiers `nixpacks.toml` et `railway.json` que nous avons créés forcent l'utilisation de npm. Vérifiez que ces fichiers sont bien commités et poussés sur GitHub.

### Erreur : Playwright ne trouve pas Chromium

**Solution** : Ajoutez cette commande dans Railway **Settings** → **Build** :
```bash
npm ci && npx playwright install --with-deps chromium
```

Ou ajoutez un script `postinstall` dans `package.json` :
```json
"scripts": {
  "postinstall": "npx playwright install --with-deps chromium"
}
```

### Le serveur ne démarre pas

**Solution** : Vérifiez les logs Railway pour voir l'erreur exacte. Assurez-vous que :
- Le port est défini via `process.env.PORT` (Railway le définit automatiquement)
- Toutes les dépendances sont installées
- Playwright est installé avec les binaires Chromium
