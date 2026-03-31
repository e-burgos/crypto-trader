# Spec 12 — DevOps (CI/CD, Docker Compose)

## Objetivo

Automatizar build, test, deploy y entorno local con Docker Compose.

## Alcance

- GitHub Actions: lint, test, build, deploy
- Docker Compose: api, web, postgres, redis

## Criterios de aceptación

- CI/CD verde en main
- Entorno local levanta todo con un solo comando
- Branch: `feature/devops`

---

**Depende de:** 11-frontend-integration
**Siguiente:** 13-e2e-tests
