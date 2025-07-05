@echo off
echo Installing Aptos CLI for Windows...
echo.

REM Check if PowerShell is available
powershell -Command "Write-Host 'PowerShell is available'" >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: PowerShell is required but not available.
    pause
    exit /b 1
)

REM Try to install using winget
echo Trying to install using winget...
winget install Aptos.AptosCLI >nul 2>&1
if %errorlevel% equ 0 (
    echo Successfully installed Aptos CLI using winget!
    goto :verify
)

REM Try to install using Chocolatey
echo Trying to install using Chocolatey...
choco install aptos-cli -y >nul 2>&1
if %errorlevel% equ 0 (
    echo Successfully installed Aptos CLI using Chocolatey!
    goto :verify
)

REM Try to install using Scoop
echo Trying to install using Scoop...
scoop install aptos-cli >nul 2>&1
if %errorlevel% equ 0 (
    echo Successfully installed Aptos CLI using Scoop!
    goto :verify
)

echo.
echo Automatic installation failed. Please install manually:
echo.
echo Option 1: Download from GitHub
echo 1. Go to: https://github.com/aptos-labs/aptos-core/releases
echo 2. Download: aptos-cli-windows-x86_64.zip
echo 3. Extract and add to PATH
echo.
echo Option 2: Install package manager first
echo - Install Chocolatey: https://chocolatey.org/install
echo - Install Scoop: https://scoop.sh/
echo.
pause
exit /b 1

:verify
echo.
echo Verifying installation...
aptos --version >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo Aptos CLI installed successfully!
    echo ========================================
    echo.
    echo You can now run the deployment script:
    echo powershell -ExecutionPolicy Bypass -File deploy.ps1
    echo.
    echo Or follow the manual deployment guide:
    echo MANUAL_DEPLOYMENT.md
    echo.
) else (
    echo.
    echo Installation completed but verification failed.
    echo Please restart your terminal and try again.
    echo.
)

pause 