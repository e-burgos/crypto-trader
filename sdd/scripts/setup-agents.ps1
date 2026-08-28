# setup-agents.ps1
# Creates/regenerates directory junctions so .claude and .github point to sdd/ sources,
# and ensures root AGENTS.md / CLAUDE.md point to sdd/dual-harness/.
# Safe to re-run at any time (idempotent + force-refresh).
# Junctions work on Windows without admin rights or Developer Mode.
# Usage: pnpm setup:agents

$root = Split-Path $PSScriptRoot -Parent

# Link-Dir TARGET SOURCE LABEL
# Always force-refreshes junctions; replaces real dirs too.
function Link-Dir {
    param($target, $source, $label)
    $null = New-Item -ItemType Directory -Force -Path (Split-Path $target)
    if (Test-Path $target) {
        $item = Get-Item $target -Force
        if ($item.LinkType -eq "Junction" -or $item.LinkType -eq "SymbolicLink") {
            Remove-Item $target -Force
            New-Item -ItemType Junction -Path $target -Target $source | Out-Null
            Write-Host "refreshed junction : $label"
        } else {
            Remove-Item $target -Recurse -Force
            New-Item -ItemType Junction -Path $target -Target $source | Out-Null
            Write-Host "replaced  -> junction: $label"
        }
    } else {
        New-Item -ItemType Junction -Path $target -Target $source | Out-Null
        Write-Host "created   junction : $label"
    }
}

# Link-File TARGET SOURCE LABEL
# Uses SymbolicLink for files (requires Developer Mode or admin on Windows).
# Falls back to HardLink if SymbolicLink fails.
function Link-File {
    param($target, $source, $label)
    $null = New-Item -ItemType Directory -Force -Path (Split-Path $target)
    if (Test-Path $target) {
        $item = Get-Item $target -Force
        if ($item.LinkType -eq "SymbolicLink" -or $item.LinkType -eq "HardLink") {
            Remove-Item $target -Force
        } else {
            # Real file — overwrite
            Remove-Item $target -Force
        }
    }
    try {
        New-Item -ItemType SymbolicLink -Path $target -Target $source | Out-Null
        Write-Host "refreshed/created symlink : $label"
    } catch {
        New-Item -ItemType HardLink -Path $target -Value $source | Out-Null
        Write-Host "refreshed/created hardlink: $label"
    }
}

# ─── 1. agents: full directory junctions ──────────────────────────────────────
$agentSource = Join-Path $root "sdd\agents"
Link-Dir (Join-Path $root ".claude\agents") $agentSource ".claude/agents -> sdd/agents"
Link-Dir (Join-Path $root ".github\agents") $agentSource ".github/agents -> sdd/agents"

# ─── 2. skills ────────────────────────────────────────────────────────────────
$skillsSource = Join-Path $root "sdd\skills"

# .claude/skills → full junction
Link-Dir (Join-Path $root ".claude\skills") $skillsSource ".claude/skills -> sdd/skills"

# .github/skills: individual junctions per SDD skill (preserves Nx skills)
$githubSkillsDir = Join-Path $root ".github\skills"
$null = New-Item -ItemType Directory -Force -Path $githubSkillsDir
foreach ($skillDir in Get-ChildItem $skillsSource -Directory) {
    $target = Join-Path $githubSkillsDir $skillDir.Name
    if (Test-Path $target) {
        $item = Get-Item $target -Force
        if ($item.LinkType -eq "Junction" -or $item.LinkType -eq "SymbolicLink") {
            Remove-Item $target -Force
            New-Item -ItemType Junction -Path $target -Target $skillDir.FullName | Out-Null
            Write-Host "refreshed junction : .github/skills/$($skillDir.Name)"
        } else {
            # Real directory — replace with junction
            Remove-Item $target -Recurse -Force
            New-Item -ItemType Junction -Path $target -Target $skillDir.FullName | Out-Null
            Write-Host "replaced  -> junction: .github/skills/$($skillDir.Name)"
        }
    } else {
        New-Item -ItemType Junction -Path $target -Target $skillDir.FullName | Out-Null
        Write-Host "created   junction : .github/skills/$($skillDir.Name)"
    }
}

# ─── 3. prompts ───────────────────────────────────────────────────────────────
$promptsSource = Join-Path $root "sdd\prompts"

# .claude/prompts → full junction
Link-Dir (Join-Path $root ".claude\prompts") $promptsSource ".claude/prompts -> sdd/prompts"

# .claude/commands → prompts as Claude Code slash commands
Link-Dir (Join-Path $root ".claude\commands") $promptsSource ".claude/commands -> sdd/prompts"

# .github/prompts: individual symlinks/hardlinks per SDD prompt (preserves non-SDD prompts)
$githubPromptsDir = Join-Path $root ".github\prompts"
$null = New-Item -ItemType Directory -Force -Path $githubPromptsDir
foreach ($promptFile in Get-ChildItem $promptsSource -Filter "*.prompt.md") {
    $target = Join-Path $githubPromptsDir $promptFile.Name
    if (Test-Path $target) {
        $item = Get-Item $target -Force
        if ($item.LinkType -eq "SymbolicLink" -or $item.LinkType -eq "HardLink") {
            # Refresh
            Remove-Item $target -Force
            try {
                New-Item -ItemType SymbolicLink -Path $target -Target $promptFile.FullName | Out-Null
                Write-Host "refreshed symlink : .github/prompts/$($promptFile.Name)"
            } catch {
                New-Item -ItemType HardLink -Path $target -Value $promptFile.FullName | Out-Null
                Write-Host "refreshed hardlink: .github/prompts/$($promptFile.Name)"
            }
        } else {
            # Real file that is NOT a link — skip (non-SDD prompt)
            Write-Host "skipped (real file): .github/prompts/$($promptFile.Name)"
        }
    } else {
        try {
            New-Item -ItemType SymbolicLink -Path $target -Target $promptFile.FullName | Out-Null
            Write-Host "created   symlink : .github/prompts/$($promptFile.Name)"
        } catch {
            New-Item -ItemType HardLink -Path $target -Value $promptFile.FullName | Out-Null
            Write-Host "created   hardlink: .github/prompts/$($promptFile.Name)"
        }
    }
}

# ─── 4. dual-harness: root AGENTS.md, CLAUDE.md and GEMINI.md ────────────────
$dualHarnessDir = Join-Path $root "sdd\dual-harness"
Link-File (Join-Path $root "AGENTS.md") (Join-Path $dualHarnessDir "AGENTS.md") "AGENTS.md -> sdd/dual-harness/AGENTS.md"
Link-File (Join-Path $root "CLAUDE.md") (Join-Path $dualHarnessDir "CLAUDE.md") "CLAUDE.md -> sdd/dual-harness/CLAUDE.md"
Link-File (Join-Path $root "GEMINI.md") (Join-Path $dualHarnessDir "GEMINI.md") "GEMINI.md -> sdd/dual-harness/GEMINI.md"

# ─── 5. Antigravity / Gemini CLI ─────────────────────────────────────────────

# .agents/rules: individual links per SDD rule (preserves user rules)
$rulesSource = Join-Path $dualHarnessDir "rules"
$agentsRulesDir = Join-Path $root ".agents\rules"
$null = New-Item -ItemType Directory -Force -Path $agentsRulesDir
foreach ($ruleFile in Get-ChildItem $rulesSource -Filter "*.md") {
    $target = Join-Path $agentsRulesDir $ruleFile.Name
    if (Test-Path $target) {
        $item = Get-Item $target -Force
        if ($item.LinkType -eq "SymbolicLink" -or $item.LinkType -eq "HardLink") {
            Link-File $target $ruleFile.FullName ".agents/rules/$($ruleFile.Name)"
        } else {
            Write-Host "skipped (real file): .agents/rules/$($ruleFile.Name)"
        }
    } else {
        Link-File $target $ruleFile.FullName ".agents/rules/$($ruleFile.Name)"
    }
}

# .agents/skills: individual junctions per SDD skill (shared SKILL.md standard:
# Antigravity and Gemini CLI both read this directory; preserves user skills)
$agentsSkillsDir = Join-Path $root ".agents\skills"
$null = New-Item -ItemType Directory -Force -Path $agentsSkillsDir
foreach ($skillDir in Get-ChildItem $skillsSource -Directory) {
    $target = Join-Path $agentsSkillsDir $skillDir.Name
    if (Test-Path $target) {
        $item = Get-Item $target -Force
        if ($item.LinkType -eq "Junction" -or $item.LinkType -eq "SymbolicLink") {
            Remove-Item $target -Force
            New-Item -ItemType Junction -Path $target -Target $skillDir.FullName | Out-Null
            Write-Host "refreshed junction : .agents/skills/$($skillDir.Name)"
        } else {
            Remove-Item $target -Recurse -Force
            New-Item -ItemType Junction -Path $target -Target $skillDir.FullName | Out-Null
            Write-Host "replaced  -> junction: .agents/skills/$($skillDir.Name)"
        }
    } else {
        New-Item -ItemType Junction -Path $target -Target $skillDir.FullName | Out-Null
        Write-Host "created   junction : .agents/skills/$($skillDir.Name)"
    }
}

# .agent/workflows: SDD prompts as Antigravity workflows (/start-sdd-cycle, ...)
$workflowsDir = Join-Path $root ".agent\workflows"
$null = New-Item -ItemType Directory -Force -Path $workflowsDir
foreach ($promptFile in Get-ChildItem $promptsSource -Filter "*.prompt.md") {
    $stem = $promptFile.Name -replace "\.prompt\.md$", ""
    $target = Join-Path $workflowsDir "$stem.md"
    if (Test-Path $target) {
        $item = Get-Item $target -Force
        if ($item.LinkType -eq "SymbolicLink" -or $item.LinkType -eq "HardLink") {
            Link-File $target $promptFile.FullName ".agent/workflows/$stem.md"
        } else {
            Write-Host "skipped (real file): .agent/workflows/$stem.md"
        }
    } else {
        Link-File $target $promptFile.FullName ".agent/workflows/$stem.md"
    }
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
    Write-Host "generated          : .gemini/commands/$stem.toml"
}

# .gemini/settings.json: make Gemini CLI also read AGENTS.md (merge, never clobber)
if (Get-Command node -ErrorAction SilentlyContinue) {
    $mergeScript = @'
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
'@
    node -e $mergeScript $root
    Write-Host "merged             : .gemini/settings.json (context.fileName)"
} else {
    Write-Host "skipped (no node)  : .gemini/settings.json — add context.fileName [GEMINI.md, AGENTS.md] manually"
}

Write-Host ""
Write-Host "done."
