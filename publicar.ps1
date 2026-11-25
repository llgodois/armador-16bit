# =====================================================================
#  PUBLICAR NO GITHUB PAGES
#  Gera o jogo (dist/) e envia para a branch gh-pages do repositório.
#  O site fica em: https://llgodois.github.io/armador-16bit/
#  Uso: clique com o botão direito -> Executar com PowerShell, ou: .\publicar.ps1
# =====================================================================
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')

npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'O build falhou.' }

$remote = git remote get-url origin
$tmp = Join-Path $env:TEMP 'armador-gh-pages'
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
Copy-Item -Recurse dist $tmp
# sem isso o GitHub Pages ignora arquivos que começam com _
New-Item -ItemType File (Join-Path $tmp '.nojekyll') | Out-Null

Push-Location $tmp
git init -q -b gh-pages
git config core.autocrlf false
git config user.name (git -C $PSScriptRoot config user.name)
git config user.email (git -C $PSScriptRoot config user.email)
git add -A
git commit -q -m "Publicar $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git push -q -f $remote gh-pages
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'Falhou o envio para o GitHub.' }
Pop-Location
Remove-Item -Recurse -Force $tmp
Write-Host 'Publicado! Em 1-2 minutos: https://llgodois.github.io/armador-16bit/'
