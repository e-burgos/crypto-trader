#!/usr/bin/env bash
# setup-agents.sh
# Creates/regenerates symlinks so .claude and .github point to sdd/ sources,
# and ensures root AGENTS.md / CLAUDE.md point to sdd/dual-harness/.
# Safe to re-run at any time (idempotent + force-refresh).
# Usage: pnpm setup:agents

set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# link TARGET SOURCE LABEL
# Always force-refreshes: replaces real dirs/files with symlinks too.
link() {
  local target="$1"
  local source="$2"
  local label="$3"
  mkdir -p "$(dirname "$target")"
  if [ -L "$target" ]; then
    ln -sfn "$source" "$target"
    echo "refreshed symlink : $label"
  elif [ -e "$target" ]; then
    rm -rf "$target"
    ln -sfn "$source" "$target"
    echo "replaced → symlink: $label"
  else
    ln -sfn "$source" "$target"
    echo "created  symlink : $label"
  fi
}

# ─── 1. agents: full symlinks ─────────────────────────────────────────────────
link "$ROOT/.claude/agents"  "../sdd/agents"   ".claude/agents -> sdd/agents"
link "$ROOT/.github/agents"  "../sdd/agents"   ".github/agents -> sdd/agents"

# ─── 2. skills ────────────────────────────────────────────────────────────────
# .claude/skills → full symlink
link "$ROOT/.claude/skills" "../sdd/skills" ".claude/skills -> sdd/skills"

# .github/skills: individual symlinks per SDD skill (preserves Nx skills)
mkdir -p "$ROOT/.github/skills"
for skill_dir in "$ROOT/sdd/skills"/*/; do
  skill=$(basename "$skill_dir")
  target="$ROOT/.github/skills/$skill"
  if [ -L "$target" ]; then
    ln -sfn "../../sdd/skills/$skill" "$target"
    echo "refreshed symlink : .github/skills/$skill"
  elif [ -d "$target" ]; then
    rm -rf "$target"
    ln -sfn "../../sdd/skills/$skill" "$target"
    echo "replaced → symlink: .github/skills/$skill"
  else
    ln -sfn "../../sdd/skills/$skill" "$target"
    echo "created  symlink : .github/skills/$skill"
  fi
done

# ─── 3. prompts ───────────────────────────────────────────────────────────────
# .claude/prompts → full symlink (referencia manual)
link "$ROOT/.claude/prompts" "../sdd/prompts" ".claude/prompts -> sdd/prompts"

# .claude/commands → los prompts como slash commands de Claude Code (/start-sdd-cycle.prompt, etc.)
link "$ROOT/.claude/commands" "../sdd/prompts" ".claude/commands -> sdd/prompts"

# .github/prompts: individual symlinks per SDD prompt (preserves non-SDD Copilot prompts)
mkdir -p "$ROOT/.github/prompts"
for prompt_file in "$ROOT/sdd/prompts/"*.prompt.md; do
  name=$(basename "$prompt_file")
  target="$ROOT/.github/prompts/$name"
  if [ -L "$target" ]; then
    ln -sfn "../../sdd/prompts/$name" "$target"
    echo "refreshed symlink : .github/prompts/$name"
  elif [ -f "$target" ]; then
    # Regular file that is NOT a symlink — skip (non-SDD prompt, e.g. monitor-ci)
    echo "skipped (real file): .github/prompts/$name"
  else
    ln -sfn "../../sdd/prompts/$name" "$target"
    echo "created  symlink : .github/prompts/$name"
  fi
done

# ─── 4. dual-harness: root AGENTS.md and CLAUDE.md ───────────────────────────
link "$ROOT/AGENTS.md" "sdd/dual-harness/AGENTS.md" "AGENTS.md -> sdd/dual-harness/AGENTS.md"
link "$ROOT/CLAUDE.md" "sdd/dual-harness/CLAUDE.md" "CLAUDE.md -> sdd/dual-harness/CLAUDE.md"

echo ""
echo "done."
