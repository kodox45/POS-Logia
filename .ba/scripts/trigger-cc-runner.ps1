param(
    [Parameter(Mandatory=$true)]
    [string]$Workspace
)

$Workspace = $Workspace.Trim('"').Trim("'")

# --- Auto-detect Claude Code CLI ---
$claudePath = $null

# 1. Check PATH
$pathResult = Get-Command "claude" -ErrorAction SilentlyContinue
if ($pathResult) {
    $claudePath = $pathResult.Source
}

# 2. Fallback: known install locations
if (-not $claudePath) {
    $knownPaths = @(
        "$env:USERPROFILE\.local\bin\claude.exe",
        "$env:LOCALAPPDATA\Programs\claude\claude.exe"
    )
    foreach ($p in $knownPaths) {
        if (Test-Path $p) {
            $claudePath = $p
            break
        }
    }
}

# --- Validate ---
if (-not $claudePath) {
    Write-Host "ERROR: Claude Code CLI not found." -ForegroundColor Red
    Write-Host "  Checked: PATH, ~/.local/bin/, LocalAppData" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

if (-not (Test-Path $Workspace)) {
    Write-Host "ERROR: Workspace not found: $Workspace" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location $Workspace

# --- Read prompt from file (avoids cmd.exe quote-stripping) ---
$promptFile = Join-Path $Workspace ".ba/triggers/.cc-prompt"

if (-not (Test-Path $promptFile)) {
    Write-Host "ERROR: Prompt file not found: $promptFile" -ForegroundColor Red
    Write-Host "  BA skill must write_file() the prompt before triggering." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$PromptText = (Get-Content $promptFile -Raw).Trim()
Remove-Item $promptFile -Force

if ([string]::IsNullOrWhiteSpace($PromptText)) {
    Write-Host "ERROR: Prompt file was empty." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# --- Header ---
Write-Host ""
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "  BA Agent V5 - Claude Code Trigger" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "  Workspace : $Workspace" -ForegroundColor Gray
Write-Host "  Claude    : $claudePath" -ForegroundColor Gray
Write-Host "  Prompt    : $PromptText" -ForegroundColor Gray
Write-Host "  Started   : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host ""

# --- Launch CC in interactive mode with initial prompt ---
# Uses positional [prompt] argument instead of pipe mode (-p).
# This gives full TUI visibility: tool calls, file reads/writes, and progress
# are all visible in real-time, instead of a blank screen until completion.
Write-Host "[Launch] Starting Claude Code with prompt..." -ForegroundColor Yellow
Write-Host "  TUI will appear below. Type /exit or Ctrl+C when done." -ForegroundColor Gray
Write-Host ""

& $claudePath $PromptText --dangerously-skip-permissions

Write-Host ""
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "  Session ended at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor DarkCyan
Read-Host "Press Enter to close"
