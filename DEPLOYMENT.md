# Guide de Déploiement

## Problèmes résolus

1. ✅ Railway utilise maintenant npm au lieu de Bun
2. ✅ Supabase a été complètement supprimé
3. ✅ Node.js 20 est configuré (via `.nvmrc`, `.node-version`, et `Dockerfile`)

## Solution : Configuration Railway

Les fichiers suivants ont été créés pour configurer Railway :

- `nixpacks.toml` - Configuration Nixpacks pour Railway
- `railway.json` - Configuration Railway
- `Procfile` - Fichier Procfile pour le démarrage
- `Dockerfile` - Alternative Dockerfile pour forcer Node.js 20
- `.nvmrc` et `.node-version` - Spécifient Node.js 20
- `.npmrc` - Configuration npm pour éviter les problèmes de cache

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

### 6. Utiliser Dockerfile (Recommandé si Nixpacks ne fonctionne pas)

Si Railway utilise toujours Node.js 18 avec Nixpacks, utilisez le Dockerfile :

1. Dans Railway Dashboard → **Settings** → **Service**
2. Changez **Builder** de `NIXPACKS` à `DOCKERFILE`
3. Railway utilisera automatiquement le `Dockerfile` qui force Node.js 20

### 7. Installer Playwright

Le script `postinstall` dans `package.json` installe automatiquement Playwright avec Chromium. Cela se fait automatiquement lors de `npm ci`.

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

## Important : Régénérer package-lock.json

Le `package-lock.json` peut encore contenir des références à Supabase. **Vous devez régénérer le lockfile localement** :

```bash
# Supprimer l'ancien lockfile
rm package-lock.json

# Réinstaller les dépendances (cela créera un nouveau package-lock.json sans Supabase)
npm install

# Vérifier que Supabase n'est plus dans le lockfile
grep -i supabase package-lock.json
# Ne devrait rien retourner

# Commiter le nouveau package-lock.json
git add package-lock.json
git commit -m "Regenerate package-lock.json without Supabase"
git push
```

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

### Erreur : Railway utilise Node.js 18 au lieu de Node.js 20

**Solution** : 
1. Utilisez le `Dockerfile` au lieu de Nixpacks (voir étape 6 ci-dessus)
2. Ou ajoutez une variable d'environnement dans Railway : `NODE_VERSION=20`

### Erreur : Playwright ne trouve pas Chromium

**Solution** : Le script `postinstall` dans `package.json` installe automatiquement Playwright. Si cela ne fonctionne pas, vérifiez les logs Railway pour voir si `postinstall` s'exécute correctement.

### Le serveur ne démarre pas

**Solution** : Vérifiez les logs Railway pour voir l'erreur exacte. Assurez-vous que :
- Le port est défini via `process.env.PORT` (Railway le définit automatiquement)
- Toutes les dépendances sont installées
- Playwright est installé avec les binaires Chromium
