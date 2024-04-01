@echo off

REM Check if the user provided a command
if "%~1"=="" (
    echo Usage: %0 ^<command^>
    exit /b 1
)

REM Execute the provided command
%*

REM Print a newline
echo.

REM Print "Done!"
echo Done!

REM Wait until Ctrl+C is pressed
:loop
timeout /t 1 /nobreak >nul
goto :loop
