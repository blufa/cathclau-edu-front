# Test manuel — mode hors-ligne de l'application desktop

Scénario à reproduire pour valider le travail hors-ligne (encaissement, dépenses, session de caisse,
inscriptions) avant de promouvoir un build en production. Voir `DEPLOY-DESKTOP.md` pour l'architecture
complète (Tauri, SQLite local, synchro automatique) et le pipeline CI.

## Produire l'exécutable

**Règle importante : un build packagé (`tauri:build`) ne se connecte JAMAIS à `localhost`.** Il pointe
toujours sur une vraie API en ligne, dev **ou** prod selon `DESKTOP_ENV` — jamais l'inverse, et jamais
sur votre backend local. C'est volontaire (voir `scripts/build-desktop.mjs`) : un poste installé n'a pas
de pipeline pour lui fournir une URL au runtime, donc elle est figée une fois pour toutes à la
compilation. Si vous voulez spécifiquement tester contre un backend en local, utilisez la variante
`tauri:dev` décrite tout en bas — jamais `tauri:build`.

### macOS (`.app` / `.dmg`) — build local, étape par étape

**1. Une seule fois** — variables de signature (mot de passe choisi à la génération de la clé) :
```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat src-tauri/keys/lacaeducation.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<mot de passe de la clé>"
```

**2a. Build DEV** (connecte à `api-dev.ecole.jeccamtech.com`, identifiant d'appli distinct — coexiste
avec une install prod sur le même Mac, auto-updater pointé sur dev) :
```bash
DESKTOP_ENV=dev npm run tauri:build -- --config src-tauri/tauri.dev.conf.json
```

**2b. Build PROD** (commande DIFFÉRENTE — sans `DESKTOP_ENV` ni `--config`, connecte à
`api.ecole.jeccamtech.com`) :
```bash
npm run tauri:build
```

**3.** Résultat dans `src-tauri/target/release/bundle/macos/*.app` et `.../dmg/*.dmg`. ⚠️ Les deux
commandes écrivent dans le MÊME dossier — le second build écrase le premier. Pour garder dev et prod
installés en même temps sur votre Mac, déplacez `bundle/` entre les deux :
```bash
mv src-tauri/target/release/bundle src-tauri/target/release/bundle-dev   # après le build dev
# ... puis lancez le build prod, qui régénère bundle/ proprement
```

**4.** Installer : ouvrir le `.dmg`, glisser l'app dans `Applications` (ou double-clic sur le `.app`
directement). Premier lancement : clic droit → Ouvrir (Gatekeeper, l'app n'est pas notarisée Apple).

### Windows (`.exe`) — récupérer depuis la CI qui vient de finir

Pas de cross-compilation fiable depuis ce Mac — la CI build sur de vrais runners `windows-latest`.

**Étape par étape, build DEV (celui qui vient de tourner) :**
1. Dépôt GitHub `lacaeducation-ui` → onglet **Actions** → *Desktop dev build (Tauri)* → cliquer sur le
   run qui vient de finir.
2. Deux façons de récupérer le `.exe` :
   - **Release GitHub** (la plus simple) : onglet **Releases** du dépôt → `desktop-dev-vX.Y.Z-<run>`
     (marquée *Pre-release*) → télécharger `*_x64-setup.exe` (poste 64 bits) ou `*_x86-setup.exe` (32
     bits).
   - **Ou** depuis le VPS, une fois copié (best effort, à vérifier) :
     `https://dev.ecole.jeccamtech.com/updates/<version>/*.exe`.
3. Transférer le `.exe` sur la machine Windows de test (le run CI ne le fait pas à votre place —
   téléchargement manuel, clé USB, partage réseau).
4. Double-clic sur l'installeur → suivre les étapes (inclut le runtime WebView2, aucun internet requis
   à l'installation).
5. Premier lancement → se connecter en ligne une fois (contre `api-dev.ecole.jeccamtech.com`) → puis
   dérouler le scénario de test ci-dessous.

**Pour la PROD** (processus différent, jamais manuel) :
1. Bump la version dans **3 fichiers** : `package.json`, `src-tauri/Cargo.toml`,
   `src-tauri/tauri.conf.json` (les 3 doivent être identiques).
2. Merge sur `main` → `desktop-tag.yml` se déclenche tout seul, crée et pousse le tag `desktop-vX.Y.Z`.
3. Ce tag déclenche `desktop-release.yml` automatiquement (build + signature + publication) — rien à
   lancer à la main.
4. Récupérable sur la Release GitHub `desktop-vX.Y.Z` (pas de suffixe `-dev`, pas *prerelease*), ou
   `https://ecole.jeccamtech.com/updates/<version>/*.exe` une fois copié sur le VPS.

### 🔜 Microsoft Store (plus tard, pas maintenant)

Vous avez mentionné vouloir héberger le `.exe` sur le Microsoft Store à terme — noté, mais volontairement
pas commencé pour l'instant (priorité à valider le hors-ligne avec l'installeur direct actuel). À garder
en tête : c'est un chantier séparé, pas juste "cocher une case" —
- Format attendu par le Store : **MSIX**, pas le NSIS `.exe` actuel (nécessite soit `tauri.conf.json`
  bundle target `msi` + le *MSIX Packaging Tool* de Microsoft, soit un outil tiers).
- Compte développeur **Microsoft Partner Center** requis (frais d'inscription unique).
- Le Store gère lui-même les mises à jour côté client → l'auto-updater maison (`plugins.updater`,
  `/updates/latest.json`) devient redondant pour la variante Store — à clarifier si vous gardez les DEUX
  canaux de distribution (direct + Store) en parallèle ou si le Store remplace l'un des deux.
- Process de certification Microsoft avant chaque publication (pas instantané comme la CI actuelle).

On y reviendra une fois le fonctionnel hors-ligne validé.

## Test contre un backend LOCAL (sans packaging, itération rapide)

Uniquement possible via `tauri:dev` (fenêtre de développement, pas un exécutable installable) :

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8284/api/v1 \
NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
npm run tauri:dev
```

Adaptez le port au backend Spring Boot local (`8284` par défaut selon `docker-compose`/`application.yml`
du dépôt backend). C'est la seule des trois options qui parle à `localhost` — ni `tauri:build`, ni
`desktop-dev-build.yml`, ni `desktop-release.yml` ne le font jamais.

## Récapitulatif — quel environnement pour quelle commande

| Commande | Connecte à | Packagé/installable ? |
|---|---|---|
| `npm run tauri:dev` (sans override) | ce que dit `.env.local` (souvent localhost par défaut) | Non |
| `NEXT_PUBLIC_API_BASE_URL=http://localhost:... npm run tauri:dev` | localhost explicite | Non |
| `DESKTOP_ENV=dev npm run tauri:build -- --config src-tauri/tauri.dev.conf.json` | `api-dev.ecole.jeccamtech.com` | Oui (.app/.dmg local) |
| `npm run tauri:build` | `api.ecole.jeccamtech.com` (**prod**) | Oui (.app/.dmg local) |
| `desktop-dev-build.yml` (CI, manuel) | `api-dev.ecole.jeccamtech.com` | Oui (.exe Windows) |
| `desktop-release.yml` (CI, tag `desktop-v*`) | `api.ecole.jeccamtech.com` (**prod**) | Oui (.exe Windows) |

---

## Plan de test — bootstrap SQLite, hors-ligne, synchronisation

**Prérequis** : un compte comptable réel (rôle ACCOUNTANT ou SCHOOL_ADMIN) avec un numéro de téléphone
personnel renseigné sur son profil, un élève déjà inscrit avec au moins une facture impayée (ex.
cantine, pour tester un "reste à payer" non vide).

### Accéder à la base SQLite locale (pour vérifier, pas juste à l'œil dans l'UI)

L'appli desktop stocke sa base dans le dossier de données de l'identifiant Tauri utilisé au build :

| Build | Chemin macOS |
|---|---|
| Dev (`com.jeccamtech.ecole.dev`) | `~/Library/Application Support/com.jeccamtech.ecole.dev/jeccam-ecole.db` |
| Prod (`com.jeccamtech.ecole`) | `~/Library/Application Support/com.jeccamtech.ecole/jeccam-ecole.db` |

Sur Windows : `%APPDATA%\com.jeccamtech.ecole(.dev)\jeccam-ecole.db`.

**Fermez l'appli avant d'ouvrir la base** (SQLite garde un verrou tant qu'un processus l'a ouverte —
sinon `sqlite3` peut lire des données pas encore flushées depuis le WAL). Exemple de consultation :

```bash
sqlite3 ~/Library/Application\ Support/com.jeccamtech.ecole.dev/jeccam-ecole.db \
  ".tables" \
  "SELECT COUNT(*) FROM classes;" \
  "SELECT COUNT(*) FROM eleves;"
```

---

## Partie A — Bootstrap : la copie serveur → SQLite au premier lancement

1. Installer, lancer, se connecter une fois **en ligne**. Attendre quelques secondes (le bootstrap
   tourne en tâche de fond, sans bloquer l'affichage).
2. Fermer l'appli, ouvrir la base SQLite (commande ci-dessus), lister les tables (`.tables`) → vérifier
   la présence de : `classes`, `eleves`, `frais_scolaires`, `factures`, `enseignants`, `matieres`,
   `classe_matieres`, `emploi_du_temps`, `fiches_depense`, `annees_scolaires`, `niveaux`, `salles`,
   `evaluations` (le référentiel en lecture) + les tables `*_offline` (files d'attente, vides au
   premier lancement).
3. Comparer un comptage avec la réalité connue de l'école, par exemple :
   ```bash
   sqlite3 jeccam-ecole.db "SELECT COUNT(*) FROM eleves;"
   ```
   → doit correspondre (à peu près, selon les filtres du bootstrap) au nombre d'élèves actifs vus sur
   `/students` en ligne.
4. Relancer l'appli hors ligne (Wi-Fi coupé avant l'ouverture) → `/classes` et `/students` doivent
   s'afficher immédiatement depuis ce miroir local, sans écran vide ni erreur.

**Ce que ça valide** : que `pullReferenceData` (`desktop-reference-sync.ts`) a bien tourné et rempli la
base au lieu de silencieusement échouer ou de ne rien copier.

---

## Partie B — Comportement hors-ligne (couper le réseau, garder l'appli ouverte)

### B0 — Couper le réseau
Wi-Fi off (ou câble débranché) — **garder l'appli ouverte**, ne pas la relancer.

### B1 — Session de caisse
1. `/payments/cashier-session` → « Ouvrir ma caisse » → badge **« Hors ligne — pas encore
   synchronisée »**, total à 0 GNF.
2. Vérifier en base : `SELECT * FROM caisse_sessions_offline WHERE synced = 0;` → une ligne, `fermee_le`
   NULL.

### B2 — Nouvelle inscription (parent + enfant)
3. `/enrollments/bulk-family` → remplir un nouveau parent + un enfant (classe, une exonération si vous
   en avez une configurée) → « Inscrire ».
4. Badge **« En attente (auto) »** immédiat (pas de tentative réseau visible, pas de badge « Échec »).
5. Vérifier en base : `SELECT * FROM inscriptions_offline WHERE synced = 0;` → une ligne, `enfants_json`
   contient bien les infos saisies.

### B3 — Encaissement (guichet)
6. `/guichet` → rechercher un élève **déjà connu** (recherché/vu en ligne avant la coupure) → la
   recherche doit continuer à fonctionner (cache).
7. Encaisser un paiement CASH pour cet élève (facture existante, pas celui qu'on vient d'inscrire
   hors-ligne — celui-là n'existe pas encore côté serveur).
8. `/payments/cashier-session` → le total encaissé a augmenté du montant payé.
9. Vérifier en base : `SELECT * FROM encaissements_offline WHERE synced = 0;` → une ligne.

### B4 — Dépense
10. `/budget` → ouvrir une fiche ouverte → ajouter une dépense → message **« Hors ligne : dépense
    enregistrée localement »** (pas d'erreur).
11. Vérifier en base : `SELECT * FROM depenses_offline WHERE synced = 0;` → une ligne.

### B5 — Lecture hors-ligne (référentiel)
12. `/classes`, `/parents`, `/payments` (liste), `/payments/reports/daily` → tout doit s'afficher depuis
    le cache (pas de page vide/erreur), à condition d'avoir été visité au moins une fois en ligne avant.

### B6 — Clôturer la caisse
13. `/payments/cashier-session` → « Clôturer ma caisse », saisir un comptant physique → message succès
    hors-ligne, l'écran repasse à « Aucune session ouverte ».
14. Vérifier en base : la ligne de `caisse_sessions_offline` de B1 a maintenant `fermee_le` renseigné,
    toujours `synced = 0`.

### B7 — Résilience (coupure en cours d'inscription)
15. Réseau toujours coupé, lancer une **deuxième** inscription à 2 enfants → couper le réseau juste
    après le 1er enfant marqué « Inscrit » (simulé : refaites l'inscription en 2 temps) → vérifier que
    seul le 2e passe en « En attente (auto) », le 1er reste « Inscrit » (jamais retraité, pas de
    doublon en base).

---

## Partie C — Synchronisation (reconnexion)

16. Réseau remis → attendre quelques secondes (déclenchement sur l'événement `online`) ou max 15 min
    (filet de sécurité, voir `desktop-sync.ts`).
17. Rouvrir la base SQLite (appli fermée) → **toutes** les lignes des tables `*_offline` touchées en
    Partie B doivent être passées à `synced = 1` :
    ```bash
    sqlite3 jeccam-ecole.db \
      "SELECT synced, COUNT(*) FROM caisse_sessions_offline GROUP BY synced;" \
      "SELECT synced, COUNT(*) FROM inscriptions_offline GROUP BY synced;" \
      "SELECT synced, COUNT(*) FROM encaissements_offline GROUP BY synced;" \
      "SELECT synced, COUNT(*) FROM depenses_offline GROUP BY synced;"
    ```
    Toute ligne encore à `synced = 0` avec `tentatives > 0` → regarder `derniere_erreur` dans la même
    table pour savoir pourquoi.
18. Côté serveur (web ou API), vérifier :
    - `/students` : le nouvel élève de B2 existe **une seule fois** (pas de doublon), bien lié au
      parent, inscrit dans la bonne classe, avec ses factures générées et son exonération appliquée.
    - Le parent a reçu un SMS de confirmation de paiement (B3) **et** le comptable qui a physiquement
      encaissé a reçu le même SMS.
    - Le reçu PDF du paiement B3 : champ « Date de paiement » = heure réelle de l'encaissement (pas
      l'heure de la reconnexion), pas de cadre de signature, tout sur une seule page.
    - `/payments/cashier-session` → historique des clôtures → la session B1/B6 apparaît avec le bon
      total système (recalculé serveur, filtré CASH uniquement) et l'écart correct.
    - `/budget` → la dépense de B4 est bien arrivée sur le serveur.

---

## Si vous testez le build dev spécifiquement (auto-updater)

19. Bumper la version, relancer `desktop-dev-build.yml`, vérifier que l'install dev déjà en place
    détecte la mise à jour (checke bien `dev.ecole.jeccamtech.com/updates/latest.json`, pas la prod).
