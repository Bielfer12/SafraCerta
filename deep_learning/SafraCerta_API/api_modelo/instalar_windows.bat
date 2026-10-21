@echo off
cd /d "%~dp0"
py -3.11 -m venv .venv
if errorlevel 1 goto erro
.venv\Scripts\python.exe -m pip install --upgrade pip
if errorlevel 1 goto erro
.venv\Scripts\python.exe -m pip install torch==2.11.0+cpu torchvision==0.26.0+cpu --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple
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
