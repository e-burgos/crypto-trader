# FIX-e-burgos-023 — POST /api/users/me/llm-keys responde 500 con una clave invalida en vez de 4xx

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-023                                   |
| **Tipo**      | BUGFIX                                  |
| **Severidad** | low                                   |
| **Keyword**   | [BUGFIX]                                |
| **Fecha**     | 2026-09-02                              |
| **Autor**     | e-burgos                                |
| **Estado**    | implemented                             |
| **Spec**      | N/A (repo-level)                        |

## Problema

Observado en los setups E2E: '[setup-admin] LLM key update: 500' al enviar una clave no valida. Deberia ser 400/422 con mensaje; no bloquea la suite porque los setups solo lo loguean.

## Justificación del bypass

Bug real destapado al actualizar la suite E2E (FIX-e-burgos-020). Se registra para no perderlo; no
está implementado todavía.

### Archivos a modificar

- `apps/api/src/users/users.controller.ts`
- `apps/api/src/users/users.service.ts`

### Test de validación

- **Referencia:** pendiente, test unitario del componente o servicio afectado al implementar.

### Decisión del Reviewer

> [A completar por sdd-reviewer al cerrar el ciclo]
>
> - [ ] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
