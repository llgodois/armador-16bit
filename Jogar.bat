@echo off
rem Abre o jogo: liga o servidor local e abre o navegador.
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias pela primeira vez...
  call npm.cmd install
)
start "" http://localhost:5173
call npm.cmd run dev
