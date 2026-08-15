@echo off
setlocal
cd /d "%~dp0android"
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"
echo Building JengaPlus APK with SDK 36...
call gradlew.bat assembleDebug
echo EXIT_CODE=%ERRORLEVEL%
endlocal