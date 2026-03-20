@echo off
echo Blog Studio 로컬 서버 (포트 3333)
echo http://localhost:3333/blog-studio-v7.html
echo 종료: Ctrl+C
cd /d "%~dp0\.."
call npx --yes serve "files (5)" -l 3333
pause
