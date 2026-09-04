#!/usr/bin/env bash
# setup-agents.sh
# Creates/regenerates symlinks so .claude, .github, .agents, .agent and .gemini point to the
# sdd/ sources, and ensures root AGENTS.md / CLAUDE.md / GEMINI.md point to sdd/dual-harness/.
# Safe to re-run at any time (idempotent + force-refresh of its own symlinks).
#
# NEVER destructive: anything that is a real file or directory (the team's own agents,
# skills, commands or root instruction files) is KEPT. When the target is a real directory
# the kit items are linked inside it; when a kit item collides with a real one, yours stays
# and the kit version lands next to it as <name>.new for you to merge (same convention as
# `harness update sdd`). Until v0.11.0 this script did `rm -rf` on real targets.
# Usage: pnpm setup:agents

set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

CONFLICTS=()

# write_new TARGET ABS_SOURCE LABEL
# The kit version next to yours: a copy for files, a pointer note for directories (a real
# directory named *.new would be discovered as a skill/agent by some harnesses).
write_new() {
  local target="$1" abs="$2" label="$3"
  if [ -d "$abs" ]; then
    printf 'Kept your %s. The kit version lives at %s — merge what you need there, then delete this note.\n' \
      "$label" "${abs#"$ROOT"/}" > "$target.new"
  else
    cp "$abs" "$target.new"
  fi
  echo "conflict (kept yours): $label — kit version at $label.new"
  CONFLICTS+=("$label")
}

# link_item TARGET REL_SOURCE ABS_SOURCE LABEL
# symlink → refresh · missing → create · real file/dir → keep + .new
link_item() {
  local target="$1" rel="$2" abs="$3" label="$4"
  if [ -L "$target" ]; then
    ln -sfn "$rel" "$target"
    echo "refreshed symlink : $label"
  elif [ -e "$target" ]; then
    write_new "$target" "$abs" "$label"
  else
    ln -sfn "$rel" "$target"
    echo "created  symlink : $label"
  fi
}

# link_items DIR REL_BASE ABS_SOURCE_DIR LABEL
# One relative symlink per kit item inside an existing real directory.
link_items() {
  local dir="$1" relbase="$2" src="$3" label="$4"
  mkdir -p "$dir"
  for item in "$src"/*; do
    [ -e "$item" ] || continue
    local name
    name="$(basename "$item")"
    link_item "$dir/$name" "$relbase/$name" "$item" "$label/$name"
  done
}

# link_dir TARGET REL_SOURCE REL_BASE_FOR_ITEMS ABS_SOURCE LABEL
# Whole-directory symlink when the target is free or already a symlink. A REAL directory
# (the team's own .claude/agents, .claude/skills, .claude/commands, .github/agents…) is kept
# and the kit items are linked inside it.
link_dir() {
  local target="$1" rel="$2" relitems="$3" abs="$4" label="$5"
  mkdir -p "$(dirname "$target")"
  if [ -L "$target" ]; then
    ln -sfn "$rel" "$target"
    echo "refreshed symlink : $label"
  elif [ -d "$target" ]; then
    echo "merging into real dir: $label (your files are kept)"
    link_items "$target" "$relitems" "$abs" "${label%% ->*}"
  else
    ln -sfn "$rel" "$target"
    echo "created  symlink : $label"
  fi
}

# ─── 1. agents ────────────────────────────────────────────────────────────────
link_dir "$ROOT/.claude/agents" "../sdd/agents" "../../sdd/agents" "$ROOT/sdd/agents" ".claude/agents -> sdd/agents"
link_dir "$ROOT/.github/agents" "../sdd/agents" "../../sdd/agents" "$ROOT/sdd/agents" ".github/agents -> sdd/agents"

# ─── 2. skills ────────────────────────────────────────────────────────────────
# .claude/skills → full symlink (or per-skill links inside the team's real directory)
link_dir "$ROOT/.claude/skills" "../sdd/skills" "../../sdd/skills" "$ROOT/sdd/skills" ".claude/skills -> sdd/skills"

# .github/skills: individual symlinks per SDD skill (preserves the repo's own skills)
link_items "$ROOT/.github/skills" "../../sdd/skills" "$ROOT/sdd/skills" ".github/skills"

# ─── 3. prompts ───────────────────────────────────────────────────────────────
# .claude/prompts → full symlink (referencia manual)
link_dir "$ROOT/.claude/prompts" "../sdd/prompts" "../../sdd/prompts" "$ROOT/sdd/prompts" ".claude/prompts -> sdd/prompts"

# .claude/commands → los prompts como slash commands de Claude Code (/start-sdd-cycle.prompt, etc.)
link_dir "$ROOT/.claude/commands" "../sdd/prompts" "../../sdd/prompts" "$ROOT/sdd/prompts" ".claude/commands -> sdd/prompts"

# .github/prompts: individual symlinks per SDD prompt (preserves non-SDD Copilot prompts)
link_items "$ROOT/.github/prompts" "../../sdd/prompts" "$ROOT/sdd/prompts" ".github/prompts"

# ─── 4. dual-harness: root AGENTS.md, CLAUDE.md and GEMINI.md ────────────────
# A real root file is kept (+ .new). `harness configure sdd` absorbs it into sdd/dual-harness/
# before calling this script, so on a fresh install these become symlinks right away.
for name in AGENTS.md CLAUDE.md GEMINI.md; do
  link_item "$ROOT/$name" "sdd/dual-harness/$name" "$ROOT/sdd/dual-harness/$name" "$name"
done

# ─── 5. Antigravity / Gemini CLI ─────────────────────────────────────────────

# .agents/rules: individual symlinks per SDD rule (preserves user rules)
link_items "$ROOT/.agents/rules" "../../sdd/dual-harness/rules" "$ROOT/sdd/dual-harness/rules" ".agents/rules"

# .agents/skills: individual symlinks per SDD skill (shared SKILL.md standard:
# Antigravity and Gemini CLI both read this directory; preserves user skills)
link_items "$ROOT/.agents/skills" "../../sdd/skills" "$ROOT/sdd/skills" ".agents/skills"

# .agent/workflows: SDD prompts as Antigravity workflows (/start-sdd-cycle, ...)
mkdir -p "$ROOT/.agent/workflows"
for prompt_file in "$ROOT/sdd/prompts/"*.prompt.md; do
  stem=$(basename "$prompt_file" .prompt.md)
  link_item "$ROOT/.agent/workflows/$stem.md" "../../sdd/prompts/$stem.prompt.md" "$prompt_file" ".agent/workflows/$stem.md"
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
if [ "${#CONFLICTS[@]}" -gt 0 ]; then
  echo "⚠ ${#CONFLICTS[@]} item(s) kept as yours — the kit version is next to each as *.new:"
  for c in "${CONFLICTS[@]}"; do echo "    ~ $c  →  $c.new"; done
  echo "  Merge what you need, delete the .new (or delete yours and re-run pnpm setup:agents)."
  echo "  Root AGENTS.md/CLAUDE.md/GEMINI.md: \`harness configure sdd\` absorbs them into sdd/dual-harness/ for you."
fi
echo "done."
