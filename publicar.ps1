# =====================================================================
#  PUBLICAR NO GITHUB PAGES
#  Publica o que JÁ ESTÁ SALVO NO GIT (último commit), a partir de uma cópia
#  limpa — trabalho pela metade nesta pasta nunca vai para o site.
#  O site fica em: https://llgodois.github.io/armador-16bit/ (16-bit)
#  e o Armador 64 também em: https://llgodois.github.io/armador-64/
#  Uso: .\publicar.ps1   (faça commit antes do que quiser publicar)
# =====================================================================
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')

$remote = git remote get-url origin
$W = Join-Path $env:TEMP 'armador-publicar'
if (Test-Path $W) {
  if (Test-Path (Join-Path $W 'node_modules')) { # o Armador 64 também tem endereço próprio: llgodois.github.io/armador-64/ (repositório armador-64,
# só com o site do 64: o 3d.html vira a página principal)
$D64 = Join-Path $W 'dist64'
Copy-Item -Recurse $D $D64
Remove-Item -Recurse -Force (Join-Path $D64 '.git')
Remove-Item -Force (Join-Path $D64 'index.html')
Move-Item (Join-Path $D64 '3d.html') (Join-Path $D64 'index.html')
Push-Location $D64
git init -q -b gh-pages
git config core.autocrlf false
git config user.name (git -C $PSScriptRoot config user.name)
git config user.email (git -C $PSScriptRoot config user.email)
git add -A 2>$null
git commit -q -m "Publicar $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>$null
git push -q -f ($remote -replace 'armador-16bit', 'armador-64') gh-pages 2>$null
$pushed64 = $LASTEXITCODE -eq 0
Pop-Location

(Get-Item (Join-Path $W 'node_modules')).Delete() }
  git worktree remove --force $W 2>$null
  if (Test-Path $W) { Remove-Item -Recurse -Force $W }
}
git worktree prune
git worktree add -q --detach $W HEAD 2>$null
# reaproveita as dependências já instaladas (atalho, sem copiar)
New-Item -ItemType Junction -Path (Join-Path $W 'node_modules') -Target (Join-Path $PSScriptRoot 'node_modules') | Out-Null

Push-Location $W
npx.cmd vite build
$ok = $LASTEXITCODE -eq 0
Pop-Location
if (-not $ok) { throw 'O build falhou.' }

$D = Join-Path $W 'dist'
# sem isso o GitHub Pages ignora arquivos que começam com _
New-Item -ItemType File (Join-Path $D '.nojekyll') -Force | Out-Null
Push-Location $D
git init -q -b gh-pages
git config core.autocrlf false
git config user.name (git -C $PSScriptRoot config user.name)
git config user.email (git -C $PSScriptRoot config user.email)
git add -A 2>$null
git commit -q -m "Publicar $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>$null
git push -q -f $remote gh-pages 2>$null
$pushed = $LASTEXITCODE -eq 0
Pop-Location

# o Armador 64 também tem endereço próprio: llgodois.github.io/armador-64/ (repositório armador-64,
# só com o site do 64: o 3d.html vira a página principal)
$D64 = Join-Path $W 'dist64'
Copy-Item -Recurse $D $D64
Remove-Item -Recurse -Force (Join-Path $D64 '.git')
Remove-Item -Force (Join-Path $D64 'index.html')
Move-Item (Join-Path $D64 '3d.html') (Join-Path $D64 'index.html')
Push-Location $D64
git init -q -b gh-pages
git config core.autocrlf false
git config user.name (git -C $PSScriptRoot config user.name)
git config user.email (git -C $PSScriptRoot config user.email)
git add -A 2>$null
git commit -q -m "Publicar $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>$null
git push -q -f ($remote -replace 'armador-16bit', 'armador-64') gh-pages 2>$null
$pushed64 = $LASTEXITCODE -eq 0
Pop-Location

(Get-Item (Join-Path $W 'node_modules')).Delete()
git worktree remove --force $W 2>$null
if (-not $pushed) { throw 'Falhou o envio para o GitHub.' }
if (-not $pushed64) { Write-Host 'Aviso: o envio do site do 64 (armador-64) falhou.' }
Write-Host 'Publicado! Em 1-2 minutos: https://llgodois.github.io/armador-16bit/ (16-bit) e https://llgodois.github.io/armador-64/ (Armador 64)'
