# ZenoCLI installer — Windows (PowerShell)
#
# Downloads the latest release zip for Windows x64 and installs the `zeno`
# command into $HOME\.zenocli\bin, then adds it to the current user's PATH.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -c "irm https://github.com/vibecoder880/ZenoCLI/raw/khanh/scripts/install.ps1 | iex"
#
# Environment:
#   ZENO_VERSION  pin a specific release tag (default: latest)
#   ZENO_PREFIX   install prefix (default: "$HOME\.zenocli")
#   ZENO_REPO     repository slug (default: vibecoder880/ZenoCLI)
#
$ErrorActionPreference = "Stop"

$repo = if ($env:ZENO_REPO) { $env:ZENO_REPO } else { "vibecoder880/ZenoCLI" }
$version = if ($env:ZENO_VERSION) { $env:ZENO_VERSION } else { "latest" }
$prefix = if ($env:ZENO_PREFIX) { $env:ZENO_PREFIX } else { Join-Path $HOME ".zenocli" }

function Write-Zeno([string]$msg) { Write-Host "[zeno] $msg" -ForegroundColor Cyan }
function Write-ZenoError([string]$msg) { Write-Host "[zeno] error: $msg" -ForegroundColor Red; exit 1 }

# --- Resolve the version --------------------------------------------------
if ($version -eq "latest") {
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest"
  $version = $release.tag_name
}
$ver = $version.TrimStart("v")
$artifact = "zeno-cli-$ver-windows-x64.zip"
$url = "https://github.com/$repo/releases/download/$version/$artifact"

Write-Zeno "ZenoCLI $version (windows-x64)"
Write-Zeno "download $url"

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("zeno-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
try {
  $zip = Join-Path $tmp $artifact
  Invoke-WebRequest -Uri $url -OutFile $zip

  $binDir = Join-Path $prefix "bin"
  New-Item -ItemType Directory -Path $binDir -Force | Out-Null
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  Copy-Item -Path (Join-Path $tmp "zeno-cli-*/bin/zeno.cmd") -Destination (Join-Path $binDir "zeno.cmd") -Force
  Copy-Item -Path (Join-Path $tmp "zeno-cli-*/dist/index.js") -Destination (Join-Path $binDir "index.js") -Force

  Write-Zeno "installed to $binDir"

  # --- Add to the current user's PATH (persistent) ------------------------
  $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if ($currentPath -notlike "*$binDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$binDir", "User")
    $env:Path = "$env:Path;$binDir"
    Write-Zeno "added $binDir to your user PATH"
  }
  Write-Zeno "done. Open a new terminal and run: zeno --help"
}
finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
