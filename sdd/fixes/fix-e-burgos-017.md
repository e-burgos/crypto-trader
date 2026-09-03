# FIX-e-burgos-017 — El deploy deja a nginx apuntando a las IPs viejas de api y web: 502 hasta reiniciarlo

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-017                        |
| **Tipo**      | HOTFIX                                  |
| **Severidad** | high                                    |
| **Keyword**   | [HOTFIX]                                |
| **Fecha**     | 2026-09-02                              |
| **Autor**     | e-burgos                                |
| **Estado**    | validated                               |
| **Spec**      | N/A (repo-level, infra de spec-e-burgos-008) |

## Problema

Al desplegar la release de spec-005 cycle-02 con los mismos comandos del paso "Desplegar" de
`deploy.yml` (`docker compose pull api web && docker compose up -d --remove-orphans`), los
contenedores `api` y `web` se recrearon con IPs nuevas de la red del compose y el contenedor
`nginx`, que llevaba 10 horas arriba, siguió resolviendo las viejas:

```
connect() failed (111: Connection refused) while connecting to upstream,
upstream: "http://172.18.0.4:3000/api/auth/login"
upstream: "http://172.18.0.6:80/login"
```

`GET /api/health` y la SPA devolvieron **502 durante ~1 minuto** aunque el healthcheck del contenedor
de la API ya estaba `healthy`. nginx resuelve los nombres de los upstreams **al arrancar** y no los
vuelve a resolver sin un `resolver` explícito con variables. El paso "Verificar desde internet" del
workflow habría detectado el 502 y marcado el deploy como fallido, pero no lo habría corregido.

## Justificación del bypass

Caída de producción en cada deploy que recree `api` o `web`. Una línea en el workflow.

## Solución aplicada

Tras `docker compose up -d --remove-orphans`, el script del paso "Desplegar" ejecuta
`docker compose up -d --force-recreate --no-deps nginx`: nginx arranca de nuevo con los upstreams
ya recreados y resuelve sus IPs vigentes. El costo es una interrupción de un par de segundos, contra
un 502 indefinido. Aplicado a mano en producción el 2026-09-02 con `docker compose restart nginx`
para restablecer el servicio.

### Archivos modificados

- `.github/workflows/deploy.yml` — recreación de `nginx` después de levantar `api` y `web`

### Test de validación

- **Referencia:** el paso "Verificar desde internet" del run de `deploy.yml` en `main` tras el fix, que
  exige `"status":"ok"` a través de nginx. Verificado a mano el 2026-09-02: tras reiniciar nginx,
  `GET /api/health` → 200 `{"status":"ok","database":"up","redis":"up"}` y SPA → 200.

### Decisión del Reviewer

> Revisado por sdd-reviewer el **2026-09-03** — evidencia ejecutada, no leída.
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia:** `.github/workflows/deploy.yml:225` ejecuta `docker compose up -d --force-recreate --no-deps nginx` después de levantar `api` y `web`; el paso 13 "Verificar desde internet" (que exige `status: ok` a través de nginx) quedó en `success` en los runs 33757979227 (2026-09-03) y 33696910696 (2026-09-02), y `GET https://trader.estebanburgos.com.ar/api/health` responde 200 `status: ok` el 2026-09-03 sin intervención manual.
