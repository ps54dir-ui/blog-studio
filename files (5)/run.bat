@echo off
echo Blog Studio 실행 중...
echo.
echo 브라우저에서 http://localhost:8080 열기
echo 종료하려면 Ctrl+C 누르세요
echo.
cd /d "%~dp0"
python -m http.server 8080
pause
