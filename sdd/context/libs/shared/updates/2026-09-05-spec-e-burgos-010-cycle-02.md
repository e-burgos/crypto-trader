# spec-e-burgos-010 cycle-02 — 2026-09-05

## Estado

- El vocabulario común del user data stream siguió al cambio de transporte: en
  `UserDataStreamHealthRecord`, `lastKeepaliveAtMs` pasó a llamarse `lastSessionAuthAtMs`. resuelve:
  la mención al keepalive del `listenKey` en el contexto base.

## Estructura

- `src/types/interfaces.ts` — único archivo tocado. El resto del record (`credentialKey`,
  `ownerId`, `connectedAt`, `lastHeartbeatAtMs`, `lastEventAtMs`, `publishedAt`) no cambió: la
  forma publicada por coordinación es la misma, cambió el significado de una señal.

## Dependencias

- Ninguna nueva.

## Qué sigue

- Nada pendiente propio de la lib en este ciclo.
