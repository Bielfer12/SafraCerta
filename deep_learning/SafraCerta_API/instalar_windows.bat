@echo off
cd /d "%~dp0"
"C:\Users\gffernandes\AppData\Local\Programs\Python\Python311\python.exe" -m venv .venv
if errorlevel 1 goto erro
.venv\Scripts\python.exe -m pip install --upgrade pip
if errorlevel 1 goto erro
.venv\Scripts\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
if errorlevel 1 goto erro
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 goto erro
echo Instalacao concluida. Execute iniciar_windows.bat.
pause
exit /b 0
:erro
echo Falha na instalacao. Confira a mensagem acima e se Python 3.11 esta instalado.
pause
exit /b 1
