@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0android"
set JAVA_HOME=C:\Program Files\jdk-17.0.20+8
set PATH=%JAVA_HOME%\bin;%PATH%

echo Building JengaPlus APK...
call gradlew.bat clean assembleDebug

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================
    echo BUILD SUCCESSFUL!
    echo APK Location:
    echo %~dp0android\app\build\outputs\apk\debug\app-debug.apk
    echo ===================================
    pause
) else (
    echo BUILD FAILED
    pause
)
endlocal
