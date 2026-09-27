# Déploiement — application desktop (Tauri)

Distribution séparée du déploiement web/Docker (`DEPLOY.md`) : un installeur natif par école, mode
hors-ligne toute la journée (SQLite local, voir `src/lib/offline/desktop-*.ts`), synchronisation
automatique dès que la connexion revient, mise à jour automatique via `https://ecole.jeccamtech.com`.

## Quel environnement le desktop utilise-t-il ?

**Production, toujours, par défaut** : `https://api.ecole.jeccamtech.com/api/v1` /
`https://ecole.jeccamtech.com`. Fixé par `scripts/build-desktop.mjs`, jamais par `.env.local` (qui reste
lu, à tort, si on ne fixe pas explicitement ces variables — un poste école n'a pas de pipeline de
déploiement pour les lui fournir au runtime comme le fait `deploy.yml` pour le web/Docker : l'export
statique fige tout au moment du build, une fois pour toutes).

Pour builder une version desktop de **dev/staging** à la place (test interne uniquement, jamais pour un
poste école) : `DESKTOP_ENV=dev npm run build:desktop` → pointe sur `api-dev.ecole.jeccamtech.com`.

## Deux bugs réels trouvés et corrigés en testant (2026-09-26/27)

1. **`asset not found: index.html`** au premier lancement de l'appli installée. Cause : la route `/`
   vit dans `src/app/(public)/page.tsx` (page marketing), or `build-desktop.mjs` écarte tout ce dossier
   avant l'export (pages incompatibles avec `output: export` — blog, pagination...). Résultat : aucun
   `index.html` n'était jamais généré à la racine. **Fix** : la fenêtre Tauri pointe maintenant
   directement sur `/login` (`tauri.conf.json` → `app.windows[0].url` + `build.devUrl`), une vraie page
   toujours générée. Revérifié : `out/login/index.html` existe après build, le `.app` reconstruit
   démarre sans crash.
2. **`npm run tauri:dev` plantait sur toute fiche réelle** (`/students/62` → 500 "missing param ...
   required with output: export"). Cause : `next.config.ts` détectait un contexte Tauri via
   `TAURI_ENV_PLATFORM`, une variable posée par la CLI Tauri aussi bien pour `tauri build` QUE pour
   `tauri dev` — du coup le SERVEUR DE DEV lui-même se comportait comme un export statique (aucun id
   réel ne peut être résolu s'il n'est pas dans `generateStaticParams`). **Fix** : seul le flag explicite
   `NEXT_OUTPUT_EXPORT=1` (posé uniquement par `build-desktop.mjs`) active `output: "export"` désormais —
   `TAURI_ENV_PLATFORM` seul n'y suffit plus. Revérifié : un build avec seulement `TAURI_ENV_PLATFORM`
   fixé produit `.next/standalone/` (mode serveur normal, tous les ids fonctionnent) ; un build via
   `build-desktop.mjs` (`NEXT_OUTPUT_EXPORT=1`) produit bien `out/` en export statique.

**Toujours non testable dans l'environnement où ce travail a été fait** (pas d'outil de pilotage
d'interface graphique) : le rendu visuel réel de l'écran de connexion et la navigation dans l'appli une
fois lancée. `cargo check` compile sans erreur, un build release complet (macOS) produit un `.app`/`.dmg`
qui démarre sans crash, mais le test de bout en bout (se connecter, encaisser hors-ligne, revenir en
ligne) reste à faire par toi avec un compte réel.

## Config Caddy pour `/updates/*` (auto-updater)

Ton Caddyfile actuel proxy tout `ecole.jeccamtech.com` vers `laca-prod-frontend:3000` — il faut une route
dédiée qui serve les fichiers statiques (installeurs + `latest.json`) SANS passer par le conteneur
frontend, pour ne jamais coupler un déploiement web à une release desktop. Ajoute, dans le bloc prod :

```caddy
# ---- lacaeducation — PRODUCTION ----
ecole.jeccamtech.com {
        encode zstd gzip

        # Auto-updater desktop (Tauri) — fichiers statiques, jamais via le conteneur frontend.
        handle_path /updates/* {
                root * /srv/updates
                file_server
        }

        reverse_proxy laca-prod-frontend:3000
}
```

`handle_path` doit être déclaré **avant** le `reverse_proxy` (Caddy évalue les directives dans l'ordre —
sinon tout, y compris `/updates/*`, part vers le frontend).

Et dans le `docker-compose.yml` du proxy, monter le dossier où la CI dépose les fichiers (le même chemin
que dans `.github/workflows/desktop-release.yml`) :

```yaml
services:
  caddy:
    image: caddy:2-alpine
    container_name: proxy-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
      - /opt/lacaeducation/updates:/srv/updates:ro   # ← ajouté
    networks: [web]
```

Puis `docker compose up -d caddy` (recharge la config) une fois le dossier `/opt/lacaeducation/updates`
créé sur l'hôte (`mkdir -p /opt/lacaeducation/updates`, la CI y écrit ensuite via SSH).

## Prérequis (une seule fois)

- La clé de signature (`src-tauri/keys/lacaeducation.key`, **jamais commitée**) — déjà générée avec un
  mot de passe. La clé publique est dans `tauri.conf.json` (`plugins.updater.pubkey`).
- Les icônes (`src-tauri/icons/`) — déjà générées depuis `src/app/icon.png` via `npx tauri icon`.
- **Secrets GitHub à ajouter** (`Settings → Secrets and variables → Actions`, dépôt frontend) :
  - `TAURI_SIGNING_PRIVATE_KEY` — contenu de `src-tauri/keys/lacaeducation.key` (le fichier entier).
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — le mot de passe choisi à la génération.
  - `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` — déjà utilisés par `deploy.yml` (web), réutilisés tels quels.

## Versionnage automatique — `.github/workflows/desktop-tag.yml`

Plus besoin de créer un tag à la main. Le flux complet :

1. Tu bumps la version dans **3 fichiers** (`package.json`, `src-tauri/Cargo.toml`,
   `src-tauri/tauri.conf.json`) — dans une PR normale.
2. Une fois mergée sur `main`, `desktop-tag.yml` se déclenche (dès que `package.json` change), vérifie
   que les 3 fichiers sont cohérents (échoue sinon, avec un message explicite), puis crée et pousse le
   tag `desktop-vX.Y.Z` **s'il n'existe pas déjà** (idempotent — un push sur `main` qui ne change pas la
   version ne fait rien).
3. Ce tag déclenche automatiquement `desktop-release.yml` (build, signature, publication).

Rien à taper à la main entre "merger le bump de version" et "la release part en CI".

## CI/CD — `.github/workflows/desktop-release.yml`

Build **Windows 64 bits ET 32 bits** (`x86_64-pc-windows-msvc` + `i686-pc-windows-msvc`, en matrice sur
`windows-latest`) — certains postes d'école peuvent être en 32 bits.

**Étapes** (par architecture, en parallèle) :
1. `npx tauri build --target <triple>` — build Next.js export (prod, via `build-desktop.mjs`) + Rust +
   installeur NSIS signé.
2. `generate-update-manifest.mjs` — construit/complète `latest.json`.
3. Upload des artefacts (`.exe` + `.sig`) et de `latest.json` comme artefacts de build GitHub.

**Publication** (job final, une fois les deux architectures terminées) :
1. Fusionne les deux `latest.json` (x64 + x86) en un seul.
2. Crée une **Release GitHub** (`desktop-v0.1.1`) avec les installeurs + `latest.json` — source de
   vérité, toujours faite, indépendante de la config serveur.
3. Copie *best effort* vers le VPS via SSH : installeurs → `/opt/lacaeducation/updates/<version>/`,
   `latest.json` → `/opt/lacaeducation/updates/latest.json` (racine — voir config Caddy ci-dessus).

## Build manuel (sans CI, pour un test ponctuel)

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat src-tauri/keys/lacaeducation.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<mot de passe de la clé>"
npm run tauri:build
node scripts/generate-update-manifest.mjs 0.1.1 https://ecole.jeccamtech.com/updates/0.1.1
```

## Installer sur un poste école

1. Récupérer l'installeur (`.exe` — `webviewInstallMode: offlineInstaller` inclut le runtime WebView2,
   donc **aucun internet requis à l'installation**, sur 32 comme 64 bits).
2. Lancer l'installeur, suivre les étapes.
3. Au premier lancement, se connecter en ligne une fois — l'appli télécharge alors tout le référentiel
   nécessaire au travail hors-ligne (classes, élèves, frais, factures, enseignants, emploi du temps...)
   dans sa base SQLite locale (créée à ce moment précis, pas avant).
4. Ensuite, l'école travaille toute la journée sans connexion — la synchronisation (encaissements,
   présences, cahier de texte, notes, dépenses) repart automatiquement dès qu'internet revient.

## Tester un build desktop en dev AVANT de promouvoir en prod

Objectif : valider un build (offline/synchro, ET l'auto-updater lui-même) contre l'environnement
dev/staging (`dev.ecole.jeccamtech.com` / `api-dev.ecole.jeccamtech.com`), sans jamais toucher aux
données ni à l'auto-updater de production.

### Piège à connaître : l'endpoint auto-updater est codé en dur

`DESKTOP_ENV=dev` (voir `scripts/build-desktop.mjs`) ne change QUE `NEXT_PUBLIC_API_BASE_URL` /
`NEXT_PUBLIC_SITE_URL` (le Next.js embarqué). L'endpoint de l'auto-updater Tauri
(`plugins.updater.endpoints` dans `tauri.conf.json`) est un réglage **Rust**, complètement séparé, et
reste toujours pointé sur `https://ecole.jeccamtech.com/updates/latest.json` (la prod) si on ne fait
rien de plus. D'où `tauri.dev.conf.json` (nouveau) : un override partiel fusionné au build via
`--config`, qui change :
- `identifier`/`productName` (`com.jeccamtech.ecole.dev` / "Jeccam École (Dev)") — pour installer un
  build dev SANS écraser une installation prod déjà présente sur le même poste de test.
- `plugins.updater.endpoints` → `https://dev.ecole.jeccamtech.com/updates/latest.json`.

Réutilise la même clé de signature que la prod (pas de secret supplémentaire à gérer) — sans risque
particulier, c'est le même périmètre de confiance.

### Config Caddy dev requise (en plus du bloc `dev.ecole.jeccamtech.com` existant)

```caddy
dev.ecole.jeccamtech.com {
        encode zstd gzip
        handle_path /updates/* {
                root * /srv/updates-dev
                file_server
        }
        reverse_proxy laca-dev-frontend:3000
}
```

Et dans le `docker-compose.yml` du proxy, un second montage (dossier hôte SÉPARÉ de la prod — sinon les
installeurs dev et prod s'écrasent mutuellement) :

```yaml
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
      - /opt/lacaeducation/updates:/srv/updates:ro
      - /opt/lacaeducation/updates-dev:/srv/updates-dev:ro   # ← dev, distinct de la prod
```

Puis sur l'hôte : `mkdir -p /opt/lacaeducation/updates-dev && docker compose up -d caddy`.

### CI — `.github/workflows/desktop-dev-build.yml`

Miroir de `desktop-release.yml`, avec trois différences : `DESKTOP_ENV=dev`, `--config
src-tauri/tauri.dev.conf.json`, publication vers `/opt/lacaeducation/updates-dev/` (jamais le dossier
prod) + Release GitHub marquée `prerelease` sous un tag `desktop-dev-vX.Y.Z-<run>` (jamais confondue
avec un vrai tag `desktop-v*`, qui seul déclenche la release prod).

**Déclenchement volontairement MANUEL** (`workflow_dispatch`, pas à chaque push sur une branche dev) —
un build signé x64+x86 coûte des minutes CI ; à lancer quand tu veux vraiment valider un build avant de
le promouvoir, pas en continu. Depuis l'onglet *Actions* du dépôt frontend : *Desktop dev build (Tauri)*
→ *Run workflow* → optionnellement préciser une branche/commit précis dans le champ `ref`.

### Récupérer et tester l'installeur dev

1. Une fois le workflow terminé : soit depuis la Release GitHub `desktop-dev-vX.Y.Z-<run>` (assets),
   soit directement depuis le VPS une fois copié : `https://dev.ecole.jeccamtech.com/updates/<version>/*.exe`.
2. L'installer sur une machine de test (peut coexister avec une install prod, identifiant différent).
3. Se connecter une fois en ligne (contre `api-dev.ecole.jeccamtech.com`), puis dérouler le scénario
   hors-ligne habituel (couper le réseau → ouvrir la caisse, encaisser, saisir une dépense, inscrire un
   élève → reconnecter → vérifier la synchro automatique).
4. Pour tester spécifiquement l'auto-updater : bumper la version, relancer ce workflow, puis vérifier
   que l'install dev déjà en place détecte et propose la mise à jour (checke
   `https://dev.ecole.jeccamtech.com/updates/latest.json`, jamais la prod).

### Alternative sans CI (itération encore plus rapide)

Pas besoin de build/installeur pour juste tester la logique offline/synchro au quotidien :

```bash
NEXT_PUBLIC_API_BASE_URL=https://api-dev.ecole.jeccamtech.com/api/v1 \
NEXT_PUBLIC_SITE_URL=https://dev.ecole.jeccamtech.com \
npm run tauri:dev
```

Lance directement la fenêtre Tauri en mode dev, branchée sur l'environnement dev — coupe le réseau
comme d'habitude pour simuler l'offline. Ne teste PAS l'auto-updater (celui-ci ne s'active que sur un
vrai build packagé) ni l'installeur lui-même, seulement la logique applicative.
