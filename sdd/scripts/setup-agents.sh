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

# ─── 4. dual-harness: root AGENTS.md, CLAUDE.md and GEMINI.md ────────────────
link "$ROOT/AGENTS.md" "sdd/dual-harness/AGENTS.md" "AGENTS.md -> sdd/dual-harness/AGENTS.md"
link "$ROOT/CLAUDE.md" "sdd/dual-harness/CLAUDE.md" "CLAUDE.md -> sdd/dual-harness/CLAUDE.md"
link "$ROOT/GEMINI.md" "sdd/dual-harness/GEMINI.md" "GEMINI.md -> sdd/dual-harness/GEMINI.md"

# ─── 5. Antigravity / Gemini CLI ─────────────────────────────────────────────

# .agents/rules: individual symlinks per SDD rule (preserves user rules)
mkdir -p "$ROOT/.agents/rules"
for rule_file in "$ROOT/sdd/dual-harness/rules/"*.md; do
  [ -e "$rule_file" ] || continue
  name=$(basename "$rule_file")
  target="$ROOT/.agents/rules/$name"
  if [ -L "$target" ]; then
    ln -sfn "../../sdd/dual-harness/rules/$name" "$target"
    echo "refreshed symlink : .agents/rules/$name"
  elif [ -f "$target" ]; then
    echo "skipped (real file): .agents/rules/$name"
  else
    ln -sfn "../../sdd/dual-harness/rules/$name" "$target"
    echo "created  symlink : .agents/rules/$name"
  fi
done

# .agents/skills: individual symlinks per SDD skill (shared SKILL.md standard:
# Antigravity and Gemini CLI both read this directory; preserves user skills)
mkdir -p "$ROOT/.agents/skills"
for skill_dir in "$ROOT/sdd/skills"/*/; do
  skill=$(basename "$skill_dir")
  target="$ROOT/.agents/skills/$skill"
  if [ -L "$target" ]; then
    ln -sfn "../../sdd/skills/$skill" "$target"
    echo "refreshed symlink : .agents/skills/$skill"
  elif [ -d "$target" ]; then
    rm -rf "$target"
    ln -sfn "../../sdd/skills/$skill" "$target"
    echo "replaced → symlink: .agents/skills/$skill"
  else
    ln -sfn "../../sdd/skills/$skill" "$target"
    echo "created  symlink : .agents/skills/$skill"
  fi
done

# .agent/workflows: SDD prompts as Antigravity workflows (/start-sdd-cycle, ...)
mkdir -p "$ROOT/.agent/workflows"
for prompt_file in "$ROOT/sdd/prompts/"*.prompt.md; do
  stem=$(basename "$prompt_file" .prompt.md)
  target="$ROOT/.agent/workflows/$stem.md"
  if [ -L "$target" ]; then
    ln -sfn "../../sdd/prompts/$stem.prompt.md" "$target"
    echo "refreshed symlink : .agent/workflows/$stem.md"
  elif [ -f "$target" ]; then
    echo "skipped (real file): .agent/workflows/$stem.md"
  else
    ln -sfn "../../sdd/prompts/$stem.prompt.md" "$target"
    echo "created  symlink : .agent/workflows/$stem.md"
  fi
done

# .gemini/commands: generated TOML wrappers so Gemini CLI exposes the SDD prompts
# as slash commands. Regenerated on every run; user commands (no marker) untouched.
mkdir -p "$ROOT/.gemini/commands"
for prompt_file in "$ROOT/sdd/prompts/"*.prompt.md; do
  stem=$(basename "$prompt_file" .prompt.md)
  target="$ROOT/.gemini/commands/$stem.toml"
  if [ -f "$target" ] && ! grep -q "generated by setup-agents" "$target"; then
    echo "skipped (real file): .gemini/commands/$stem.toml"
    continue
  fi
  cat > "$target" <<EOF
# generated by setup-agents from sdd/prompts/$stem.prompt.md — do not edit
description = "SDD: $stem (fuente: sdd/prompts/$stem.prompt.md)"

prompt = """
@{sdd/prompts/$stem.prompt.md}

{{args}}
"""
EOF
  echo "generated        : .gemini/commands/$stem.toml"
done

# .gemini/settings.json: make Gemini CLI also read AGENTS.md (merge, never clobber)
if command -v node >/dev/null 2>&1; then
  node -e '
    const fs = require("fs");
    const path = require("path");
    const file = path.join(process.argv[1], ".gemini", "settings.json");
    let settings = {};
    try { settings = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
    settings.context = settings.context || {};
    const current = settings.context.fileName;
    const names = Array.isArray(current) ? current : current ? [current] : [];
    for (const name of ["GEMINI.md", "AGENTS.md"]) {
      if (!names.includes(name)) names.push(name);
    }
    settings.context.fileName = names;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(settings, null, 2) + "\n");
  ' "$ROOT" && echo "merged           : .gemini/settings.json (context.fileName)"
else
  echo "skipped (no node): .gemini/settings.json — add context.fileName [GEMINI.md, AGENTS.md] manually"
fi

echo ""
echo "done."
