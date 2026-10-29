@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node_modules\vite\bin\vite.js" (
  echo 请先安装 Node.js，然后在本目录执行 npm install。
  pause
  exit /b 1
)
echo 兔兔小窝将在 http://127.0.0.1:5188/ 开始放映。
start "" "http://127.0.0.1:5188/"
node "node_modules\vite\bin\vite.js" --host 127.0.0.1 --port 5188 --strictPort
pause
