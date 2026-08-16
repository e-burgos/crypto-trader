# Installing and updating the SDD framework

## Updating an already-installed kit (the common case)

If this repo already has `sdd/` and a new kit version is out, **none of what follows is
needed** — a single command updates everything while preserving what is yours:

```bash
npx @e-burgos/sdd-harness@latest update sdd
```

What it does, governed by the hashes in `sdd/kit.json`:

| File type | What happens on update |
| --- | --- |
| **Your data** — `global.json`, specs, cycles, fixes, contexts, `memory/journal/` | **Never touched** |
| Kit files **unmodified** locally (skills, agents, prompts, schemas, scripts, viewer) | Replaced by the new version |
| Kit files **new** in this version | Added on their own |
| Kit files **you edited** (typically `dual-harness/AGENTS.md`/`CLAUDE.md`) | Your version stays intact; the new one lands next to it as `*.new` so you merge by hand what you care about |

At the end it regenerates the catalog, refreshes the symlinks and runs `sdd:validate`. If
the update lists `*.new` conflicts, merge them (or ask your agent to) and delete the `.new`
files.

---

# Installing the SDD framework on a new repo

This folder is a **clean, portable** copy of the SDD system: no specs, fixes, tasks or
contexts from any project. Every registry is empty and validates against its schema.

## Steps

1. **Copy this folder into the target repo as `sdd/`** (the name matters: scripts,
   prompts and agents reference `sdd/...` paths):

   ```bash
   cp -R sdd-portable /path/to/repo/sdd
   ```

   If the target repo starts from scratch (no Nx workspace), create the workspace first
   following `sdd/skills/scaffold-nx/skill.md` and the reference files in
   `sdd/templates/nx-workspace/` (`create-nx-workspace` + aligned root config).

2. **Register the scripts in the target repo's root `package.json`:**

   ```json
   {
     "scripts": {
       "setup:agents": "node -e \"if(process.platform==='win32'){require('child_process').execSync('powershell -ExecutionPolicy Bypass -File sdd/scripts/setup-agents.ps1',{stdio:'inherit'})}else{require('child_process').execSync('bash sdd/scripts/setup-agents.sh',{stdio:'inherit'})}\"",
       "sdd:docs": "node sdd/docs/serve.mjs",
       "sdd:validate": "node sdd/scripts/validate-sdd.mjs",
       "sdd:rebuild-tasks-index": "node sdd/scripts/rebuild-tasks-index.mjs",
       "sdd:rebuild-catalog": "node sdd/scripts/rebuild-catalog.mjs"
     }
   }
   ```

3. **Generate the harness symlinks** (`.claude/`, `.github/`, root `CLAUDE.md`/`AGENTS.md`
   pointing at `sdd/dual-harness/`):

   ```bash
   pnpm setup:agents
   ```

4. **Fill in the templates** — look for the `[...]` markers:
   - `sdd/global.json` → `project`, `description`, `monorepo` (real apps/libs).
     **`project` and `description` are the single source of truth for the name and the
     description: no other file in `sdd/` hardcodes them, everything points here.** That is
     what keeps `sdd/` portable across repos, and `pnpm sdd:validate` verifies it.
   - `sdd/context/constitution.md` → vision, responsibilities, principles, tables
   - `sdd/context/context_prompt.md` → architectural role and real structure
   - `sdd/context/[apps|libs|tools]/[name]/` → create each subproject's context when
     generating it with Nx (starts empty)

5. **Validate:**

   ```bash
   pnpm sdd:validate
   ```

6. (Optional) **CI:** copy the validation workflow from the source repo
   (`.github/workflows/sdd-validate.yml`) so every PR touching `sdd/**` runs
   `pnpm sdd:validate`.

## What is included

| Folder / file      | Contents                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `agents/`          | The 7 agents of the SDD cycle                                                                   |
| `skills/`          | 18 skills (SDD cycle + sdd-hermes + code generators + scaffold-nx + setup-graphify)             |
| `templates/`       | Reproducible scaffolding: nx-workspace, java-api, react-app, ts-lib — see `templates/README.md` |
| `prompts/`         | Gate prompts (SPEC GATE, FIX GATE, cycle open/close, hermes-resume)                             |
| `memory/`          | Project memory: distilled `lessons.md` + episodic `journal/` (MEMORIA GATE)                     |
| `pricing.json`     | Editable rates for the viewer's Costs dashboard                                                 |
| `schemas/`         | Strict JSON Schemas for every registry                                                          |
| `scripts/`         | validate, rebuild-tasks-index, rebuild-catalog, setup-agents                                    |
| `docs/`            | Portable documentation viewer (vanilla JS, zero deps)                                           |
| `dual-harness/`    | CLAUDE.md / AGENTS.md to link at the repo root                                                  |
| `context/`         | Constitution and context prompt templates (global + example)                                    |
| `specs/`, `fixes/` | Empty, ready for the first specs and fixes                                                      |
| `*.json`           | Empty, valid state registries (`sdd:validate` OK)                                               |

Full usage guide: [HOW-TO-USE-SDD.md](HOW-TO-USE-SDD.md) · System reference: [README.md](README.md)
