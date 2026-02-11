# Fix pour Railway - Node.js 20 et Supabase

## Problème

Railway utilise Node.js 18 au lieu de Node.js 20, et le `package-lock.json` contient encore des références à Supabase.

## Solution

### 1. Régénérer package-lock.json localement

Exécutez ces commandes **localement** pour régénérer le `package-lock.json` sans Supabase :

```bash
# Supprimer l'ancien lockfile
rm package-lock.json

# Réinstaller les dépendances (cela créera un nouveau package-lock.json)
npm install

# Vérifier que Supabase n'est plus dans le lockfile
grep -i supabase package-lock.json
# Ne devrait rien retourner

# Commiter le nouveau package-lock.json
git add package-lock.json
git commit -m "Regenerate package-lock.json without Supabase"
git push
```

### 2. Vérifier que Railway utilise Node.js 20

Les fichiers suivants sont déjà créés pour forcer Node.js 20 :
- `.nvmrc` (contient `20`)
- `.node-version` (contient `20`)

Si Railway utilise toujours Node.js 18, vous pouvez :

**Option A : Configurer dans Railway Dashboard**
1. Allez dans votre projet Railway
2. Settings → Variables
3. Ajoutez une variable d'environnement :
   - **Name**: `NODE_VERSION`
   - **Value**: `20`

**Option B : Utiliser un Dockerfile**
Créez un `Dockerfile` à la racine :

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --prefer-offline --no-audit

COPY . .

RUN npm run postinstall || true

CMD ["npm", "run", "server"]
```

Puis dans Railway, configurez pour utiliser Dockerfile au lieu de Nixpacks.

### 3. Résoudre l'erreur EBUSY

L'erreur `EBUSY: resource busy or locked` est causée par le cache npm. Le fichier `.npmrc` a été créé avec `prefer-offline=true` pour éviter ce problème.

Si le problème persiste, ajoutez dans Railway Settings → Build :
- **Build Command**: `rm -rf node_modules/.cache && npm ci --prefer-offline --no-audit`

## Fichiers créés/modifiés

- ✅ `.nvmrc` - Spécifie Node.js 20
- ✅ `.node-version` - Spécifie Node.js 20  
- ✅ `.npmrc` - Configuration npm pour éviter les problèmes de cache
- ✅ `nixpacks.toml` - Configuration Nixpacks
- ✅ `railway.json` - Configuration Railway

## Prochaines étapes

1. **Régénérer package-lock.json localement** (voir étape 1 ci-dessus)
2. **Pousser les changements** sur GitHub
3. **Redéployer sur Railway** - Railway devrait maintenant utiliser Node.js 20
4. **Vérifier les logs** - Vous devriez voir Node.js 20 dans les logs
