---
name: sdd-reviewer
description: SDD Reviewer Agent Skill. Validates the quality of all cycle output. Invoke after all implementation tasks for the cycle are complete.
---

# Skill: sdd-reviewer

## Review checklist

- [ ] ⛔ `pnpm sdd:validate` green BEFORE reviewing and AFTER closing — a cycle can NEVER be approved with malformed registries; record the result in `reviewer_report.tests["sdd:validate"]`
- [ ] Schema compatible with existing `sdd/schema.json` (check app-key section)
- [ ] `sdd/api.json` — endpoints under correct app-key, status `implemented` or `updated`
- [ ] `sdd/components.json` — components under correct app-key, `created_in_cycle` set
- [ ] `sdd/schema.json` — tables under correct app-key, `migration_file` updated
- [ ] `sdd/specs/{spec-id}/cycles/cycle-[XX]/tasks.json` with cycle tasks marked `done` + index regenerated (`pnpm sdd:rebuild-tasks-index`) + `pnpm sdd:validate` green
- [ ] Code has NO narrative comments, commented-out code, task/spec/cycle references or `// TODO` (dual-harness rule ✍️; that context belongs in `planner.md`/`architect.md`, not in code; allowed only: issue-linked workaround, business rule referencing its spec, framework annotations / linter-required Javadoc) → otherwise request changes
- [ ] Additive context fragment written at `sdd/context/[apps|libs|tools]/[name]/updates/YYYY-MM-DD-[spec-id]-cycle-[XX].md` — base `constitution.md`/`context_prompt.md` NOT edited during the cycle (dual-harness rule 🧩)
- [ ] MEMORIA GATE (dual-harness rule 🧠): if the cycle produced a real lesson (failed assumption, costly discovery, avoidable token spend), a journal entry exists at `sdd/memory/journal/YYYY-MM-DD-[spec-id]-cycle-[XX].md`; `sdd/memory/lessons.md` NOT edited during the cycle. No lesson → no entry (noise filter)
- [ ] Usage telemetry recorded (best-effort, feeds the Costs dashboard): `cycle.json` → `metrics.usage` with the cycle's approximate `tokens_in`/`tokens_out` (+ `duration_minutes`, `by_tier` if known); per-task `usage` in the cycle's `tasks.json` when the implementor reported it. Approximations are fine; omit only when there is no signal at all

## Files modified on approval

- `sdd/global.json` — moves module from `in_progress_modules` to `completed_modules` (with `apps[]`, `cycles_completed`, `completed_at`)
- `sdd/specs/index.json` — spec entry → `status: "completed"` + `completed_at` (if this was the spec's last cycle)
- `sdd/specs/{spec-id}/cycles/cycle-[XX]/cycle.json` — updates `status` to `"completed"` and fills `reviewer_report`
- `sdd/specs/{spec-id}/cycles/cycle-[XX]/tasks.json` — all tasks `"done"`; then `pnpm sdd:rebuild-tasks-index`
- `sdd/api.json` — verify/correct `updated_in_cycle` and `changelog` for all touched endpoints
- `sdd/schema.json` — verify/correct `updated_in_cycle` and `changelog` for all touched tables
- `sdd/components.json` — verify/correct entries for all components created or modified
- `sdd/fixes.json` — review fixes with `status: "implemented"` in this cycle → mark `"validated"` or `"absorbed"`
- `sdd/context/[apps|libs|tools]/[name]/updates/YYYY-MM-DD-[spec-id]-cycle-[XX].md` — CONTEXTO GATE: append-only delta fragment (state / structure / dependencies / next); the subproject's base files are only touched by the single-actor consolidation (orchestrator at next cycle start on that subproject, or reviewer at ≥5 accumulated fragments — dedicated commit, delete merged fragments)
- `sdd/context/constitution.md` + `context_prompt.md` (global) — direct edit of the affected subproject's row ONLY (append new row for new app/lib; never reformat the tables)
- `sdd/memory/journal/YYYY-MM-DD-[spec-id]-cycle-[XX].md` — only when the cycle left a real lesson (what happened / lesson / avoidable cost); distillation into `lessons.md` is the orchestrator's single-actor job at next cycle start

## App-key mapping (reference)

| App              | Key en los JSON      |
| ---------------- | -------------------- |
| example-api      | `"example-api"`      |
| otra API backend | `"another-api"`      |
| app React        | `"apps/example-app"` |
| api-client lib   | `"libs/api-client"`  |
| sdd-docs (visor) | `"tools/sdd-docs"`   |

> Al agregarse una app/lib nueva al monorepo, extender esta tabla desde `monorepo.apps` de `sdd/global.json`.
