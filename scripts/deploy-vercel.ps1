# Deploy @qauto/web to Vercel (run from repo root after `vercel login`)
$ErrorActionPreference = "Stop"
$ApiUrl = "https://qautoapi-production.up.railway.app"
$WebDir = Join-Path $PSScriptRoot ".." "apps" "web" | Resolve-Path

Write-Host "Linking Vercel project in apps/web..."
Push-Location $WebDir
try {
  if (-not (Test-Path ".vercel/project.json")) {
    vercel link --yes
  }

  $envs = @(
    @{ Key = "NEXT_PUBLIC_API_URL"; Value = "/api/v1" },
    @{ Key = "API_PROXY_TARGET"; Value = $ApiUrl },
    @{ Key = "NEXT_PUBLIC_WS_URL"; Value = "$ApiUrl/ws" }
  )

  foreach ($e in $envs) {
    Write-Host "Setting $($e.Key)..."
    $e.Value | vercel env add $e.Key production --force 2>$null
    if ($LASTEXITCODE -ne 0) {
      vercel env rm $e.Key production --yes 2>$null
      $e.Value | vercel env add $e.Key production
    }
  }

  Write-Host "Deploying to production..."
  vercel deploy --prod --yes
} finally {
  Pop-Location
}
