@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
 echo Execute instalar_windows.bat primeiro.
 pause
 exit /b 1
)
echo Teste no notebook: http://127.0.0.1:8000/docs
echo Para encerrar, pressione Ctrl+C. Mantenha esta janela aberta.
.venv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8000 --workers 1
pause
