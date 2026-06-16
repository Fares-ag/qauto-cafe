# Claim qauto.thedev.id — run after: gh auth login
$ErrorActionPreference = "Stop"
$gh = "$env:ProgramFiles\GitHub CLI\gh.exe"
$work = Join-Path $env:TEMP "thedev.id-claim"

if (-not (Test-Path $gh)) {
  Write-Error "Install GitHub CLI: winget install GitHub.cli"
}

& $gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Run: gh auth login --web"
  exit 1
}

$cloneDir = Join-Path $env:TEMP "thedev.id-claim"
if (Test-Path $cloneDir) { Remove-Item -Recurse -Force $cloneDir }
New-Item -ItemType Directory -Path $cloneDir | Out-Null
Push-Location $cloneDir
& $gh repo fork thedev-id/thedev.id --clone
if (-not (Test-Path "thedev.id")) {
  Write-Error "Fork clone failed"
}
Push-Location "thedev.id"

git checkout -b add-qauto-subdomain 2>$null
if ($LASTEXITCODE -ne 0) { git checkout add-qauto-subdomain }

$json = Get-Content subdomains.json -Raw | ConvertFrom-Json
if ($json.qauto) {
  Write-Host "qauto entry already exists: $($json.qauto)"
} else {
  $json | Add-Member -NotePropertyName qauto -NotePropertyValue "cname.vercel-dns.com"
  $sorted = [ordered]@{}
  $json.PSObject.Properties.Name | Sort-Object | ForEach-Object { $sorted[$_] = $json.$_ }
  ($sorted | ConvertTo-Json) -replace '\r?\n', "`n" | Set-Content subdomains.json -NoNewline
  npm install --silent
  npm run sort
  git add subdomains.json
  git commit -m "Add qauto.thedev.id for QAuto Cafe (Vercel)"
}

git push -u origin add-qauto-subdomain --force
& $gh pr create --repo thedev-id/thedev.id --head "Fares-ag:add-qauto-subdomain" --title "Add qauto.thedev.id" --body "Points qauto.thedev.id to Vercel (QAuto Cafe POS). CNAME: cname.vercel-dns.com"

Pop-Location
Pop-Location
Write-Host "Done. After PR merge, https://qauto.thedev.id will go live."
