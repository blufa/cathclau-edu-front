# Déploiement

Ce dépôt (**frontend**) fournit son `Dockerfile` et ses workflows GitHub Actions
(`.github/workflows/`) : à chaque push sur `develop`/`main`, l'image est construite avec l'URL d'API
de l'environnement et poussée sur **GHCR**, puis déployée par SSH sur le VPS.

Le **guide de déploiement complet** (Hostinger DNS → VPS → variables d'environnement → GitHub Actions,
pour backend **et** frontend) vit dans le dépôt **backend** :

> `lacaeducation/deploy/README.md`

La stack `docker-compose` (backend + frontend + PostgreSQL + proxy Caddy) y est centralisée : c'est la
source unique du déploiement. Ce dépôt front n'a pas besoin de sa propre stack.

## Secrets GitHub requis (ce dépôt aussi)
`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (voir le guide backend).
