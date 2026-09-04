# setup-agents.ps1
# Creates/regenerates directory junctions so .claude, .github, .agents, .agent and .gemini
# point to the sdd/ sources, and ensures root AGENTS.md / CLAUDE.md / GEMINI.md point to
# sdd/dual-harness/. Safe to re-run at any time (idempotent + force-refresh of its own links).
# Junctions work on Windows without admin rights or Developer Mode.
#
# NEVER destructive: anything that is a real file or directory (the team's own agents,
# skills, commands or root instruction files) is KEPT. When the target is a real directory
# the kit items are linked inside it; when a kit item collides with a real one, yours stays
# and the kit version lands next to it as <name>.new for you to merge (same convention as
# `harness update sdd`). Until v0.11.0 this script removed real targets.
# Usage: pnpm setup:agents

$root = Split-Path $PSScriptRoot -Parent
$script:Conflicts = @()

function Is-Link($item) {
    return ($item.LinkType -eq "Junction" -or $item.LinkType -eq "SymbolicLink" -or $item.LinkType -eq "HardLink")
}

# Write-New TARGET SOURCE LABEL — the kit version next to yours: a copy for files, a pointer
# note for directories (a real directory named *.new would be discovered as a skill by some harnesses).
function Write-New {
    param($target, $source, $label)
    $newPath = "$target.new"
    if (Test-Path $source -PathType Container) {
        $rel = $source.Substring($root.Length).TrimStart('\', '/') -replace '\\', '/'
        Set-Content -Path $newPath -Value "Kept your $label. The kit version lives at $rel - merge what you need there, then delete this note."
    } else {
        Copy-Item -Path $source -Destination $newPath -Force
    }
    Write-Host "conflict (kept yours): $label - kit version at $label.new"
    $script:Conflicts += $label
}

# New-Link TARGET SOURCE — junction for directories, symlink (hardlink fallback) for files.
function New-Link {
    param($target, $source)
    if (Test-Path $source -PathType Container) {
        New-Item -ItemType Junction -Path $target -Target $source | Out-Null
    } else {
        try {
            New-Item -ItemType SymbolicLink -Path $target -Target $source | Out-Null
        } catch {
            New-Item -ItemType HardLink -Path $target -Value $source | Out-Null
        }
    }
}

# Link-Item TARGET SOURCE LABEL
# link -> refresh · missing -> create · real file/dir -> keep + .new
function Link-Item {
    param($target, $source, $label)
    $null = New-Item -ItemType Directory -Force -Path (Split-Path $target)
    if (Test-Path $target) {
        $item = Get-Item $target -Force
        if (Is-Link $item) {
            Remove-Item $target -Force
            New-Link $target $source
            Write-Host "refreshed link    : $label"
        } else {
            Write-New $target $source $label
        }
    } else {
        New-Link $target $source
        Write-Host "created   link    : $label"
    }
}

# Link-Items DIR SOURCE_DIR LABEL — one link per kit item inside an existing real directory.
function Link-Items {
    param($dir, $sourceDir, $label, $filter = "*")
    $null = New-Item -ItemType Directory -Force -Path $dir
    foreach ($item in Get-ChildItem $sourceDir -Filter $filter -Force) {
        Link-Item (Join-Path $dir $item.Name) $item.FullName "$label/$($item.Name)"
    }
}

# Link-Dir TARGET SOURCE LABEL
# Whole-directory junction when the target is free or already a link. A REAL directory
# (the team's own .claude/agents, .claude/skills, .claude/commands, .github/agents...) is kept
# and the kit items are linked inside it.
function Link-Dir {
    param($target, $source, $label)
    $null = New-Item -ItemType Directory -Force -Path (Split-Path $target)
    if (Test-Path $target) {
        $item = Get-Item $target -Force
        if (Is-Link $item) {
            Remove-Item $target -Force
            New-Item -ItemType Junction -Path $target -Target $source | Out-Null
            Write-Host "refreshed junction : $label"
        } else {
            Write-Host "merging into real dir: $label (your files are kept)"
            Link-Items $target $source ($label -replace ' ->.*$', '')
        }
    } else {
        New-Item -ItemType Junction -Path $target -Target $source | Out-Null
        Write-Host "created   junction : $label"
    }
}

# ─── 1. agents ────────────────────────────────────────────────────────────────
$agentSource = Join-Path $root "sdd\agents"
Link-Dir (Join-Path $root ".claude\agents") $agentSource ".claude/agents -> sdd/agents"
Link-Dir (Join-Path $root ".github\agents") $agentSource ".github/agents -> sdd/agents"

# ─── 2. skills ────────────────────────────────────────────────────────────────
$skillsSource = Join-Path $root "sdd\skills"

# .claude/skills → full junction (or per-skill links inside the team's real directory)
Link-Dir (Join-Path $root ".claude\skills") $skillsSource ".claude/skills -> sdd/skills"

# .github/skills: individual junctions per SDD skill (preserves the repo's own skills)
Link-Items (Join-Path $root ".github\skills") $skillsSource ".github/skills"

# ─── 3. prompts ───────────────────────────────────────────────────────────────
$promptsSource = Join-Path $root "sdd\prompts"

# .claude/prompts → full junction
Link-Dir (Join-Path $root ".claude\prompts") $promptsSource ".claude/prompts -> sdd/prompts"

# .claude/commands → prompts as Claude Code slash commands
Link-Dir (Join-Path $root ".claude\commands") $promptsSource ".claude/commands -> sdd/prompts"

# .github/prompts: individual links per SDD prompt (preserves non-SDD prompts)
Link-Items (Join-Path $root ".github\prompts") $promptsSource ".github/prompts" "*.prompt.md"

# ─── 4. dual-harness: root AGENTS.md, CLAUDE.md and GEMINI.md ────────────────
# A real root file is kept (+ .new). `harness configure sdd` absorbs it into sdd/dual-harness/
# before calling this script, so on a fresh install these become links right away.
$dualHarnessDir = Join-Path $root "sdd\dual-harness"
foreach ($name in @("AGENTS.md", "CLAUDE.md", "GEMINI.md")) {
    Link-Item (Join-Path $root $name) (Join-Path $dualHarnessDir $name) $name
}

# ─── 5. Antigravity / Gemini CLI ─────────────────────────────────────────────

# .agents/rules: individual links per SDD rule (preserves user rules)
Link-Items (Join-Path $root ".agents\rules") (Join-Path $dualHarnessDir "rules") ".agents/rules" "*.md"

# .agents/skills: individual junctions per SDD skill (shared SKILL.md standard:
# Antigravity and Gemini CLI both read this directory; preserves user skills)
Link-Items (Join-Path $root ".agents\skills") $skillsSource ".agents/skills"

# .agent/workflows: SDD prompts as Antigravity workflows (/start-sdd-cycle, ...)
$workflowsDir = Join-Path $root ".agent\workflows"
$null = New-Item -ItemType Directory -Force -Path $workflowsDir
foreach ($promptFile in Get-ChildItem $promptsSource -Filter "*.prompt.md") {
    $stem = $promptFile.Name -replace "\.prompt\.md$", ""
    Link-Item (Join-Path $workflowsDir "$stem.md") $promptFile.FullName ".agent/workflows/$stem.md"
}

# .gemini/commands: generated TOML wrappers so Gemini CLI exposes the SDD prompts
# as slash commands. Regenerated on every run; user commands (no marker) untouched.
$geminiCommandsDir = Join-Path $root ".gemini\commands"
$null = New-Item -ItemType Directory -Force -Path $geminiCommandsDir
foreach ($promptFile in Get-ChildItem $promptsSource -Filter "*.prompt.md") {
    $stem = $promptFile.Name -replace "\.prompt\.md$", ""
    $target = Join-Path $geminiCommandsDir "$stem.toml"
    if ((Test-Path $target) -and -not (Select-String -Path $target -Pattern "generated by setup-agents" -Quiet)) {
        Write-Host "skipped (real file): .gemini/commands/$stem.toml"
        continue
    }
    $toml = @"
# generated by setup-agents from sdd/prompts/$stem.prompt.md — do not edit
description = "SDD: $stem (fuente: sdd/prompts/$stem.prompt.md)"

prompt = """
@{sdd/prompts/$stem.prompt.md}

{{args}}
"""
"@
    Set-Content -Path $target -Value $toml -Encoding UTF8
    Write-Host "generated        : .gemini/commands/$stem.toml"
}

# .gemini/settings.json: make Gemini CLI also read AGENTS.md (merge, never clobber)
$settingsPath = Join-Path $root ".gemini\settings.json"
$null = New-Item -ItemType Directory -Force -Path (Split-Path $settingsPath)
$settings = @{}
if (Test-Path $settingsPath) {
    try { $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json -AsHashtable } catch { $settings = @{} }
}
if (-not $settings.ContainsKey("context") -or $null -eq $settings["context"]) { $settings["context"] = @{} }
$current = $settings["context"]["fileName"]
$names = @()
if ($current -is [array]) { $names = @($current) } elseif ($current) { $names = @($current) }
foreach ($n in @("GEMINI.md", "AGENTS.md")) { if ($names -notcontains $n) { $names += $n } }
$settings["context"]["fileName"] = $names
$settings | ConvertTo-Json -Depth 10 | Set-Content -Path $settingsPath -Encoding UTF8
Write-Host "merged           : .gemini/settings.json (context.fileName)"

Write-Host ""
if ($script:Conflicts.Count -gt 0) {
    Write-Host "! $($script:Conflicts.Count) item(s) kept as yours - the kit version is next to each as *.new:"
    foreach ($c in $script:Conflicts) { Write-Host "    ~ $c  ->  $c.new" }
    Write-Host "  Merge what you need, delete the .new (or delete yours and re-run pnpm setup:agents)."
    Write-Host "  Root AGENTS.md/CLAUDE.md/GEMINI.md: 'harness configure sdd' absorbs them into sdd/dual-harness/ for you."
}
Write-Host "done."
