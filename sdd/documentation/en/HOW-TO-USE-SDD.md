# SDD system usage guide

> **Spec-Driven Development (SDD)** — step by step for developers.  
> Read this document before any new task in the repository.

---

## Table of contents

1. [The concept in 30 seconds](#1-the-concept-in-30-seconds)
2. [Initial setup (once)](#2-initial-setup-once)
3. [Normal flow — New functionality](#3-normal-flow--new-functionality)
4. [Subproject context — additive updates](#4-subproject-context--additive-updates)
5. [Fast flow — Fix / Improvement](#5-fast-flow--fix--improvement)
6. [SDD file reference](#6-sdd-file-reference)
7. [Naming conventions](#7-naming-conventions)
8. [Absolute rules (never break)](#8-absolute-rules-never-break)
9. [Prompt cheat sheet](#9-prompt-cheat-sheet)
10. [Hermes, memory and costs — the end to end](#10-hermes-memory-and-costs--the-end-to-end)

---

## 1. The concept in 30 seconds

```
IDEA → dev prompt → SPEC (Orchestrator) → CYCLE (5 agents) → IMPLEMENTATION → REVIEW → CLOSE
```

- **The dev describes what they want** — they do not write SDD documents, they write natural-language prompts and attach references.
- **The agents generate every artifact** — spec, functional.md, planner.md, architect.md, cycle.json, etc.
- **The dev reviews and approves** what each agent produces before moving to the next one.
- **Not a single line of code** is written until the 6 cycle documents exist and are approved
  (`brief.yaml`, `functional.md`, `planner.md`, `architect.md`, `tasks.json`, `cycle.json`).
- The **Reviewer** closes the cycle and writes an **additive context fragment** so the next
  agent has the state (see section 4 — it prevents merge conflicts between devs).
- **Every `sdd/**/*.json` registry validates against `sdd/schemas/`** — `pnpm sdd:validate` runs locally, in the Reviewer and in CI.

---

## 2. Initial setup (once)

### 2.a Repo already initialized — normal clone

```bash
pnpm install        # pnpm is the ONLY package manager: never npm install or yarn
pnpm setup:agents
pnpm sdd:validate   # must end green
```

> ⛔ `npm install` or `yarn` in this repo produce a rival lockfile. Nx infers the package manager
> from the lockfile, so that silently changes how tasks resolve. `.npmrc` carries
> `package-manager-strict=true` and `.gitignore` blocks `package-lock.json`/`yarn.lock`, but the
> rule is simply not to run them.

### 2.b New repo, or `sdd/` ported into another repo

If `nx.json`, `pnpm-workspace.yaml`, `.npmrc` or `.nxignore` are missing — or an npm/yarn
lockfile shows up — the workspace is not assembled. Ask an agent to use the
**`init-nx-workspace`** skill: it sets up Nx 23 + pnpm, the `apps/* libs/* tools/*` globs, the
`.nxignore`, pnpm-based CI and the dual harness, and ends with a verifiable command-by-command
checklist.

The dual harness (`AGENTS.md`/`CLAUDE.md`) instructs agents to check this **at the start of
every session**, so they normally detect it on their own before their first action.

> Creating apps or libs is **not** part of that skill: that is `scaffold-nx`, and always inside
> an SDD cycle.

### 2.c What `setup:agents` generates

This script generates (or regenerates) every required symlink:

| Symlink created            | Points to                                       |
| -------------------------- | ----------------------------------------------- |
| `.claude/agents`           | `sdd/agents/`                                   |
| `.claude/skills`           | `sdd/skills/`                                   |
| `.claude/prompts`          | `sdd/prompts/`                                  |
| `.claude/commands`         | `sdd/prompts/` (Claude Code slash commands)     |
| `.github/agents`           | `sdd/agents/`                                   |
| `.github/skills/<skill>`   | `sdd/skills/<skill>/` (one by one)              |
| `.github/prompts/<prompt>` | `sdd/prompts/<prompt>` (one by one)             |
| `AGENTS.md` (root)         | `sdd/dual-harness/AGENTS.md`                    |
| `CLAUDE.md` (root)         | `sdd/dual-harness/CLAUDE.md`                    |

> It is safe to re-run `pnpm setup:agents` at any time — it regenerates everything without
> breaking anything. **On Windows it is mandatory** after every clone: git leaves the symlinks
> as text files and the script replaces them with junctions/hardlinks.
> `.github/copilot-instructions.md` is a real file (not a symlink) for GitHub's server-side readers.

### SDD viewer (optional, recommended)

To browse the whole SDD state in the browser instead of reading JSON by hand:

```bash
pnpm sdd:docs        # → http://127.0.0.1:4310/sdd/docs/
```

It is a 5-file vanilla JS app: **zero dependencies, zero build, zero install**. It reads the
`sdd/` registries live, so what you see is the repo's real state, not a snapshot. It has 15
views (dashboard, specs, cycles, tasks, fixes, context, agents, skills, prompts, schema, API,
components, JSON schemas, planning and help).

### Knowledge graph (optional)

`graphify` indexes the repo as a graph and allows scoped queries (`graphify query "..."`)
instead of blind `grep` — useful to understand architecture or run impact analysis before a
refactor. It is **opt-in per dev** and nothing in the SDD flow depends on it. To enable it, ask
an agent to use the `setup-graphify` skill: it walks you through installing it with a **free**
backend (Gemini free tier or local Ollama).

---

## 3. Normal flow — New functionality

### Step 0 — Check the project state

Before starting, verify there is no module in progress. The Orchestrator does this
automatically, but you can also check it directly:

```bash
cat sdd/global.json
```

Conditions to be able to start:

- **Your spec has no other open cycle** — the rule is _one active cycle per spec_.
  Several devs can have their modules in `in_progress_modules` in parallel (multi-developer model).
- If your functionality depends on another spec (`depends_on` in `sdd/specs/index.json`),
  that spec must be `completed`.

---

### Step 1 — Describe the functionality to the Orchestrator

**The dev does not create SDD files.** Instead, they write a natural-language prompt describing
what they want to build and attach the relevant references (business documents, wireframes,
existing endpoints, external API contracts, etc.).

**Example message to the `sdd-orchestrator` agent:**

```
I want to implement the Market Data Feed module for the <app-name> app.

Goal: consume real-time prices from the Plug provider and expose them
via WebSocket to frontend clients.

Attached references:
- docs/artifacts/plug/api-spec.pdf  (provider contract)
- sdd/api.json                      (already-implemented endpoints)
- sdd/context/apps/<app-name>/constitution.md
```

**The Orchestrator automatically generates:**

1. The `.spec.md` spec file with goal, context, scope and acceptance criteria.
2. The corresponding entry in `sdd/specs/index.json`.
3. The module registration in `pending_modules` inside `sdd/global.json`.
4. `cycle-01/brief.yaml` with the minimum context for each agent.
5. `cycle-01/cycle.json` with `status: "in-progress"` (validates against `sdd/schemas/cycle.schema.json`).
6. Runs `pnpm sdd:validate` — the cycle is not registered if any registry is out of schema.

**The dev reviews and approves** the generated documents before continuing.
If something does not reflect what you want, fix the prompt and ask again.

> ⛔ **The Orchestrator does NOT implement code.** It only generates the brief and the spec artifacts.

---

### Step 2 — Functional agent

The `sdd-functional` agent reads the brief generated by the Orchestrator and produces the user stories.

**Prompt to the agent:**

```
Generate functional.md for Cycle 01 — spec-<gh-user>-<NNN>-<slug>.
```

The agent reads `brief.yaml` and generates `cycle-01/functional.md` with **As / I want / So that**
stories, verifiable `CA-[NNN]` acceptance criteria (PASS/FAIL) and error cases.

**The dev reviews** that the stories cover the spec's goal. If coverage is missing, tell the
agent so it adjusts.

---

### Step 3 — Planner and Architect agents (parallel)

Both can run **in parallel** (two simultaneous conversations) because they are independent of
each other.

**Prompt to the `sdd-planner` agent:**

```
Generate planner.md for Cycle 01 — spec-<gh-user>-<NNN>-<slug>.
```

The Planner reads `functional.md` and `brief.yaml`, and generates **two files**:

- `cycle-01/planner.md` — readable sprint plan with `TASK-001`, `TASK-002`… tasks (scope: the cycle),
  each with hour estimation, story points and dependencies.
- `cycle-01/tasks.json` — the same tasks in canonical format (schema `cycle-tasks.schema.json`),
  regenerating the index with `pnpm sdd:rebuild-tasks-index`.

**Prompt to the `sdd-architect` agent:**

```
Generate architect.md for Cycle 01 — spec-<gh-user>-<NNN>-<slug>.
```

The Architect reads `functional.md`, `brief.yaml`, `sdd/schema.json` and `sdd/api.json`, and generates:

- `cycle-01/architect.md` with technical decisions, DB schema and endpoint contracts.
- Updates `sdd/schema.json` and `sdd/api.json` with the new artifacts.

**The dev reviews both documents.** If there are inconsistencies between planner and architect
(e.g. a task mentions an endpoint the architect did not define), tell each agent to fix it.

> Supporting documents (diagrams, endpoint examples, code exploration) produced by the Architect:
> → **always** store them in `cycle-01/artifacts/` and reference them in `cycle.json["artifacts"]`.

---

### Step 4 — Implementation

With the 6 cycle documents ready and approved, the implementors are invoked **task by task**.
One task per conversation, no batching. The stack is defined by the subproject's `constitution.md`.

**Prompt to the `sdd-implementor-back` agent (one task at a time):**

```
Implement TASK-001 of Cycle 01 — spec-<gh-user>-<NNN>-<slug>.
```

The agent reads the task in `cycle-01/tasks.json`, the contract in `architect.md` and the
subproject's `constitution.md`; writes the code and the tests. On closing each task: it marks
`"done"` + `files[]` in `tasks.json` and runs `pnpm sdd:rebuild-tasks-index && pnpm sdd:validate`.

**Prompt to the `sdd-implementor-front` agent (only if there are FE tasks, after the backend):**

```
Implement TASK-00X of Cycle 01 — spec-<gh-user>-<NNN>-<slug>.
```

The frontend agent first verifies the consumed endpoints are `"implemented"` in `sdd/api.json`.

**The dev reviews** the generated code task by task. If something does not meet the spec, tell
the agent what to fix before moving to the next task.

---

### Step 5 — Review and close

With every task implemented, invoke the `sdd-reviewer` agent:

```
Review Cycle 01 — spec-<gh-user>-<NNN>-<slug> — Module <name>.
```

The Reviewer performs, **in mandatory order**:

0. ⛔ **VALIDATION GATE (pre-review)** — runs `pnpm sdd:validate`; if it fails, back to the implementor.
1. Validates the code meets the acceptance criteria (`ca_results` with one PASS/FAIL per `CA-[NNN]`).
2. Updates `cycle.json` → `status: "completed"` + `completed_at` + `metrics` + `reviewer_report`.
3. Moves the module to `completed_modules` in `global.json` (with `apps[]`, `cycles_completed`, `completed_at`).
4. If it was the spec's last cycle → `status: "completed"` + `completed_at` in `sdd/specs/index.json`.
5. Marks the cycle's tasks as `done` in `cycles/cycle-[XX]/tasks.json` and regenerates the index (`pnpm sdd:rebuild-tasks-index`).
6. Verifies `sdd/schema.json`, `sdd/api.json` and `sdd/components.json` are up to date.
7. Reviews the cycle's `implemented` fixes in `sdd/fixes.json` → marks them `validated` or `absorbed`.
8. ⛔ **CONTEXTO GATE (additive)** — writes the cycle's fragment and touches **only its own row**
   in the global tables:
   - `sdd/context/[apps|libs|tools]/<name>/updates/YYYY-MM-DD-<spec-id>-cycle-XX.md` ← **the delta**
   - `sdd/context/constitution.md` → only the subproject's row in the snapshot table
   - `sdd/context/context_prompt.md` → new row only if an app/lib/tool was created

   > ⛔ It does **not** edit the subproject's `constitution.md` or `context_prompt.md`, nor its
   > `> Última actualización:` line. See section 4.

9. ⛔ **VALIDATION GATE (post-close)** — `pnpm sdd:validate` green, recorded in `reviewer_report.tests["sdd:validate"]`.

> The cycle **cannot close** with the CONTEXTO GATE pending or the validation red —
> the same check runs in CI (`.github/workflows/sdd-validate.yml`) and breaks the PR.

---

## 4. Subproject context — additive updates

**The problem it solves:** when several devs work different specs on the same subproject
(e.g. `example-api`), they all used to edit the same `constitution.md` and `context_prompt.md`
when closing their cycle. Guaranteed merge conflicts, made worse by the
`> Última actualización:` line everyone touched.

**The solution:** during a cycle or fix the subproject's base files are **never** edited. An
append-only fragment is written whose name includes the spec-id — which carries the dev's
gh-user — so **it is unique by construction** and the conflict cannot happen.

```
sdd/context/[apps|libs|tools]/<name>/updates/
  ├── 2026-07-13-spec-asmith-001-cycle-01.md
  ├── 2026-08-03-fix-jdoe-002-001.md        ← fixes: YYYY-MM-DD-fix-<gh-user>-<seq>.md
  └── 2026-08-04-spec-jdoe-003-cycle-01.md
```

### Fragment template (only the delta, never copy from the base)

```markdown
# <spec-id> cycle-<XX> — <YYYY-MM-DD>

## Estado → what got implemented / what state the subproject is left in

## Estructura → new or changed packages/modules/patterns

## Dependencias → new libraries or services it consumes/exposes

## Qué sigue → pending items the next cycle must know
```

Empty sections are omitted. If the cycle resolved something the base declares "pending", note
it as `resuelve: <section>` so consolidation removes it.

### The 3 operations

| Operation                                                                            | Who                                                                                                          | When        |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ----------- |
| **Write** the fragment                                                               | reviewer on cycle close · dev on fix close                                                                   | every close |
| **Read** context = base + `updates/*.md` in name order                               | any agent                                                                                                    | always      |
| **Consolidate**: merge fragments into the bases, update the header, delete them      | **a single actor**: orchestrator when opening a new cycle on that subproject, or reviewer with ≥5 fragments  | periodic    |

> Consolidation goes in a dedicated commit (`chore(sdd): consolidate context updates for <name>`)
> and **never** in parallel with an open cycle on the same subproject.
> The `> Última actualización:` line only changes there.

**If you need to read a subproject's context:** base + fragments. The fragments are ordered
chronologically by the date prefix, so reading them in name order gives the real evolution.

```bash
# How many unconsolidated fragments there are (≥5 triggers consolidation)
ls sdd/context/*/*/updates/*.md 2>/dev/null | wc -l
```

---

## 5. Fast flow — Fix / Improvement

When the change **does not justify a full SDD cycle**, use the FIX GATE.

### When to use each prefix

| Prefix          | When                                        | Severity            |
| --------------- | ------------------------------------------- | ------------------- |
| `[HOTFIX]`      | Production blocked, critical regression     | `critical` / `high` |
| `[BUGFIX]`      | Error in development or testing             | `medium` / `low`    |
| `[FIX]`         | Generic alias (the orchestrator classifies) | any                 |
| `[IMPROVEMENT]` | Minor UX/wording/performance improvement    | `low`               |

> ⚠️ If the fix touches more than 5 files or changes an API contract → **full SDD cycle**.

### FIX GATE step by step

**1. Send the prefixed message to the Orchestrator:**

```
[BUGFIX] The /enrollment endpoint returns 500 when the CUIT has format X.
```

**2. The Orchestrator blocks implementation** and asks for this data:

```
1. Type: [HOTFIX] / [BUGFIX] / [IMPROVEMENT]
2. Title (max 80 chars)
3. Description of the problem
4. Urgency justification
5. Affected files
6. Is there a test validating the fix?
```

**3. The Orchestrator registers the fix:**

- Adds an entry to `sdd/fixes.json` with the author's sequential ID (`FIX-<gh-user>-001`, `FIX-<gh-user>-002`…
  or `FIX-<gh-user>-<spec-NNN>-<seq>` if it belongs to a spec). Validates against `sdd/schemas/fixes.schema.json`.
- Creates `sdd/fixes/fix-<gh-user>-<seq>.md` (repo-level fix)  
  or `sdd/specs/<spec-id>/fixes/fix-<gh-user>-<spec-NNN>-<seq>.md` (spec fix).

**4. Only after registration → implement.**

**5. When done:** update in `sdd/fixes.json` → `affected_files`, `resolved_at`, `status: "implemented"`
and `test_reference`. The Reviewer will mark it `validated` or `absorbed` on cycle close.
Run `pnpm sdd:validate` before committing.

---

## 6. SDD file reference

### State files (always update on cycle close)

| File                         | Contents                                        | Who updates                                                              |
| ---------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| `sdd/global.json`            | Project state, modules in progress              | Orchestrator (open) + Reviewer (close)                                   |
| `cycles/cycle-XX/tasks.json` | The cycle's canonical tasks                     | Planner (creates) + Implementors + Reviewer                              |
| `sdd/tasks.json`             | Tasks index (generated)                         | `pnpm sdd:rebuild-tasks-index`                                           |
| `sdd/catalog.json`           | Content manifest for the viewer (generated)     | `pnpm sdd:rebuild-catalog` — `sdd:validate` fails if it is stale         |
| `sdd/schema.json`            | Database schema                                 | Architect (defines) + Back implementor (migrates) + Reviewer             |
| `sdd/api.json`               | Endpoint contracts                              | Architect (defines) + Back implementor (implements) + Reviewer           |
| `sdd/components.json`        | Frontend components created                     | Front implementor + Reviewer                                             |
| `sdd/fixes.json`             | Registry of out-of-flow fixes                   | Orchestrator (FIX GATE) + dev (close) + Reviewer (validates)             |
| `sdd/specs/index.json`       | Spec registry (append-only)                     | Whoever creates the spec + Reviewer (close)                              |
| `sdd/schemas/*.schema.json`  | Strict JSON Schemas (machine source)            | Manual — a schema change is a team decision                              |

### Context files (read before any task)

| File                                       | What for                                                  |
| ------------------------------------------ | --------------------------------------------------------- |
| `sdd/context/context_prompt.md`            | Global entry point — read first                           |
| `sdd/context/constitution.md`              | Global architecture + subproject summary table            |
| `sdd/context/apps/<app>/context_prompt.md` | The app's state — BASE (only consolidation touches it)    |
| `sdd/context/apps/<app>/constitution.md`   | Stack, packages, patterns — BASE                          |
| `sdd/context/apps/<app>/updates/*.md`      | Per-cycle/fix fragments — **read together with the base** |
| `sdd/context/tools/<tool>/`                | Same, for tools that are neither app nor lib              |

### Cycle documents (6 files per cycle, only these)

```
sdd/specs/<spec-id>/cycles/cycle-<XX>/
  ├── brief.yaml       ← Orchestrator
  ├── functional.md    ← Functional agent
  ├── planner.md       ← Planner agent
  ├── architect.md     ← Architect agent
  ├── tasks.json       ← Planner (creates) + Implementors (status) — the cycle's CANONICAL tasks
  ├── cycle.json       ← Orchestrator (open) + Reviewer (close)
  └── artifacts/       ← Supporting docs (referenced in cycle.json)
```

---

## 7. Naming conventions

### Spec ID

```
spec-<gh-user>-<NNN>-<slug>
```

- `<gh-user>`: the author's GitHub handle (e.g. `jdoe`)
- `<NNN>`: the dev's **personal** counter, starting at `001` (not global)
- `<slug>`: descriptive kebab-case for the module

Examples:

```
spec-jdoe-001-enrollment-request
spec-asmith-001-market-data-feed
```

### Cycles

```
cycle-01, cycle-02, ...
```

They reset per spec (they are not global to the repo).

### Tasks

```
TASK-001, TASK-002, ...
```

The scope is the cycle's `tasks.json` — no spec, cycle or layer (BE/FE) prefix.
The same IDs are used in `planner.md` and in `cycles/cycle-XX/tasks.json`.

### Fixes

```
fix-<gh-user>-<seq>.md              ← repo-level (sdd/fixes/)
fix-<gh-user>-<spec-NNN>-<seq>.md   ← spec-scoped (sdd/specs/<id>/fixes/)
```

---

## 8. Absolute rules (never break)

### ⛔ SPEC GATE — before implementing

```
1. Does the spec's .spec.md file exist?                    → YES / NO
2. Is the spec in sdd/specs/index.json?                    → YES / NO
3. Is the module in in_progress_modules (global.json)?     → YES / NO
4. Does the cycle's brief.yaml exist?                      → YES / NO
5. Does the cycle's functional.md exist?                   → YES / NO
6. Does the cycle's planner.md exist?                      → YES / NO
7. Does the cycle's architect.md exist?                    → YES / NO
8. Does cycle.json exist with status "in-progress"?        → YES / NO
9. Does the cycle's tasks.json exist, with tasks?          → YES / NO
10. Does the affected subproject's constitution.md exist?  → YES / NO
```

**If any is NO → STOP. Complete that step before continuing.**

### ⛔ CONTEXTO GATE — before closing a cycle (ADDITIVE)

```
1. Does the cycle's fragment exist in context/[apps|libs|tools]/<name>/updates/?  → YES / NO
2. Is the subproject's own row in context/constitution.md's snapshot table current? → YES / NO
3. Is a new row needed in context/context_prompt.md (new app/lib/tool)?             → YES / NO / N/A
4. Were the subproject's BASE files left untouched?                                 → YES / NO
```

**cycle.json CANNOT have status "completed" without the fragment written.**
And if point 4 is NO, something is wrong: only consolidation touches the bases (see section 4).

### Other rules

- **One active cycle per spec.** Different devs advance their specs in parallel, but a given
  spec never has two open cycles.
- **Only 6 files at the cycle root** (`brief.yaml`, `functional.md`, `planner.md`, `architect.md`, `cycle.json`, `tasks.json`). Anything else → `artifacts/`.
- **Strict typing:** every `sdd/**/*.json` registry validates against `sdd/schemas/`. Run `pnpm sdd:validate` after any write.
- **`sdd/specs/index.json` is append-only** — never edit existing entries.
- **Implementors receive ONE task per message**, not several.
- **The Orchestrator does NOT write code** — it only prepares the brief.
- **Zero comments in implementation code.** Documentation lives in the SDD documents, not in
  comments. Declarative names and short functions instead. No `// TODO` — that is a task or a
  fix. Exceptions (1 line, English): a constraint the code cannot express, or an annotation
  required by a framework/linter. The reviewer checks this on close.
- **Choose model and effort before starting**: the cheapest tier that does the job. Implementors
  `sonnet`/`medium`; orchestrator, architect and reviewer `opus`/`high`. Never a whole fan-out
  on the most expensive tier.
- **graphify is optional** — if `graphify-out/graph.json` exists, query it before blind
  `grep`/`Read`; otherwise work normally. To enable it: `setup-graphify` skill.
- **Workspace invariants** (guaranteed by the `init-nx-workspace` skill; breaking them fails
  silently): pnpm is the only package manager; projects live in `apps/`, `libs/` and `tools/`
  — never in `packages/` —; `customConditions` in `tsconfig.base.json` is **identical** to the
  root `package.json` `name`; and `.nxignore` contains `sdd/templates` so the blueprints stay
  out of the project graph.
- **The project name and description live ONLY in `sdd/global.json`** (`project` /
  `description`). No other file in `sdd/` hardcodes them — that is what keeps `sdd/` portable,
  and `pnpm sdd:validate` fails if the value leaks into the kit's documents.

---

## 9. Prompt cheat sheet

```bash
# See the project state
cat sdd/global.json

# See registered specs
cat sdd/specs/index.json

# See the current cycle's tasks
cat sdd/tasks.json                       # index: totals per spec/cycle
cat sdd/specs/<spec-id>/cycles/cycle-01/tasks.json  # the cycle's task detail
pnpm sdd:validate                        # validate every registry
pnpm sdd:rebuild-tasks-index             # regenerate the index after touching tasks
pnpm sdd:rebuild-catalog                 # regenerate the manifest after adding/removing an agent, skill, prompt or schema

# See implemented endpoints
cat sdd/api.json

# Initial setup of a clone / regenerate symlinks
pnpm install                             # pnpm only — never npm install or yarn
pnpm setup:agents

# Open the SDD viewer (reads the registries live, zero build)
pnpm sdd:docs                            # → http://127.0.0.1:4310/sdd/docs/

# Unconsolidated context fragments (≥5 triggers consolidation)
ls sdd/context/*/*/updates/*.md 2>/dev/null | wc -l
```

### Invocation prompts per agent

```
# Orchestrator (describe in natural language + attach references)
"I want to implement <description>.
[Attach relevant references]"

# Functional
"Generate functional.md for Cycle 01 — <spec-id>."

# Planner + Architect (parallel)
"Generate planner.md for Cycle 01 — <spec-id>."
"Generate architect.md for Cycle 01 — <spec-id>."

# Implement a task
"Implement TASK-001 of Cycle 01 — <spec-id>."

# Review and close
"Review Cycle 01 — <spec-id>."

# Urgent fix
"[BUGFIX] <description of the problem>"
```

---

## 10. Hermes, memory and costs — the end to end

### 10.1 From an idea to product (`sdd-hermes` skill)

The SDD cycle starts at a spec — Hermes starts **earlier**: at the idea. The whole protocol
lives in `sdd/skills/sdd-hermes/skill.md`; the entry point is one command:

```bash
# Empty repo — register the idea and leave everything ready for the agent:
npx @e-burgos/sdd-harness idea "a booking app for hair salons with reminders"
# → harness.idea.md          (the idea + the protocol to follow, with human checkpoints)
# → harness.config.json      (stack stub, the agent completes it)
# → harness.config.schema.json (to validate the config without running the CLI)

# The agent decides the stack (human checkpoint), and generates the workspace without a single prompt:
npx @e-burgos/sdd-harness init --config ./harness.config.json

# Existing workspace — same entry point, gap protocol:
harness idea "add sales reports"   # → harness.idea.md with an analysis vs the installed stack
```

Inside the workspace, the agent follows phases 4–5 of the skill: one spec per module
(`harness add spec`, human checkpoint) and the usual cycle loop — Hermes **bypasses no
gate**, it only chains phases.

**Resume in any session** (state lives in the registries, not in the session): hand the agent
`sdd/prompts/hermes-resume.prompt.md` — it diagnoses the position (open cycle → continue;
pendings → orchestrator; empty backlog → report) and carries on.

### 10.2 Memory (the dual-harness 🧠 rule)

Two layers of versioned files, zero dependencies:

- `sdd/memory/lessons.md` — distilled lessons, capped at 120 lines. **Read in full at the
  start of every session.**
- `sdd/memory/journal/` — episodic entries on cycle/fix close, **only if there was a real
  lesson** (anti-noise filter). Never read whole.

```markdown
<!-- sdd/memory/journal/2026-08-13-spec-jdoe-001-cycle-01.md -->
# spec-jdoe-001 cycle-01 — 2026-08-13

## Qué pasó → the payments API mock does not simulate timeouts; 2 tasks blocked
## Lección → test against the real payments sandbox from the first cycle
## Costo evitable → ~40 min and two re-implementations
```

With ≥5 entries, the orchestrator **distills** them into `lessons.md` (one line per lesson)
and deletes what it distilled — `pnpm sdd:validate` warns when that is pending.

### 10.3 Telemetry and the Costs dashboard

On closing each cycle, the reviewer records the approximate consumption (an honest
approximation is fine; an invented number is not):

```jsonc
// cycle.json → metrics
"usage": {
  "tokens_in": 980000, "tokens_out": 151000, "duration_minutes": 65,
  "by_tier": { "sonnet": { "tokens_in": 830000, "tokens_out": 130000 },
               "opus":   { "tokens_in": 150000, "tokens_out": 21000 } }
}
```

With that, `pnpm sdd:docs` → **Costs** view: agentic cost (tokens × per-tier rate) compared
against the traditional estimation (`estimation_hours` of the tasks × hourly rate), projected
saving, tokens per cycle and the exact table. Rates are edited in `sdd/pricing.json`.

The viewer is also **reactive locally**: it polls a per-area fingerprint of the registries
every 4 s — you close a cycle and the active view refreshes on its own, without reloading and
without losing what you had expanded. On static hosting it falls back to manual refresh.

---

## Full flow diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEW FUNCTIONALITY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Dev describes the functionality (prompt + references)         │
│         ↓                                                       │
│  sdd-orchestrator → .spec.md + index.json + global.json        │
│                   → brief.yaml + cycle.json (in-progress)      │
│         ↓                                                       │
│  sdd-functional → functional.md (stories + verifiable CAs)     │
│         ↓                                                       │
│  sdd-planner ──┐    planner.md + tasks.json (TASK-NNN)         │
│  (parallel)    ├──→                                            │
│  sdd-architect─┘    architect.md + schema.json + api.json      │
│         ↓                                                       │
│  sdd-implementor-back  (task by task → done + validate)        │
│  sdd-implementor-front (task by task, if FE exists)            │
│         ↓                                                       │
│  sdd-reviewer → VALIDATION GATE + cycle.json (completed)       │
│               + CONTEXTO GATE + pnpm sdd:validate green        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    FIX / IMPROVEMENT                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Dev sends [HOTFIX|BUGFIX|IMPROVEMENT] <description>           │
│         ↓                                                       │
│  sdd-orchestrator BLOCKS implementation                        │
│         ↓                                                       │
│  Registers in fixes.json + creates fix-*.md                    │
│         ↓                                                       │
│  Implements the fix → status "implemented" + sdd:validate      │
│         ↓                                                       │
│  The Reviewer validates/absorbs it on cycle close              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
