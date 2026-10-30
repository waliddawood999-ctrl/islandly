@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
set "ACTIVATED="
set "STAGE=preflight"
if not defined LOCALAPPDATA goto failed
if not defined APPDATA goto failed
set "DEST=%LOCALAPPDATA%\Islandly"
set "SOURCE=%~dp0payload"
set "MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Islandly.lnk"
set "ARP=HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Islandly"
set "RUN=HKCU\Software\Microsoft\Windows\CurrentVersion\Run"
if /i "%~nx0"=="Uninstall.cmd" if "%~1"=="" goto uninstall
if /i "%~1"=="/uninstall" goto uninstall
if /i "%~1"=="/startup-on" goto startupOn
if /i "%~1"=="/startup-off" goto startupOff
call :checkClosed
if errorlevel 1 exit /b 1
if not exist "%SOURCE%\Islandly.exe" goto failed
if not exist "%SOURCE%\BINARY-SHA256.txt" goto failed
if exist "%DEST%" if not exist "%DEST%\.islandly-install" (
 echo Installation folder is not managed by this installer. / المجلد ليس تابعًا لهذا المثبّت.
 exit /b 1
)
echo Close Islandly from its tray menu before updating. / أغلق Islandly من قائمة الأيقونة قبل التحديث.
rem No killing unrelated processes, elevation, policy changes, script execution bypass or downloaded tools.
"%SystemRoot%\System32\certutil.exe" -hashfile "%SOURCE%\panels\Islandly.exe" SHA256 | "%SystemRoot%\System32\findstr.exe" /i /x /c:"758e43cf25850408fa42d7de76565561ae329b353b8facc508ece9875bcd1592" >nul
if errorlevel 1 goto failed
set "STAGE=binary manifest"
for /f "usebackq tokens=1,*" %%A in ("%SOURCE%\BINARY-SHA256.txt") do (
 "%SystemRoot%\System32\certutil.exe" -hashfile "%SOURCE%\%%B" SHA256 | "%SystemRoot%\System32\findstr.exe" /i /x /c:"%%A" >nul
 if errorlevel 1 goto failed
)
if exist "%DEST%.previous" goto failed
if exist "%DEST%.staging" goto failed
set "STAGE=staging copy"
mkdir "%DEST%.staging" || goto failed
"%SystemRoot%\System32\robocopy.exe" "%SOURCE%" "%DEST%.staging" /E /R:0 /W:0 /NFL /NDL /NJH /NJS >nul
if errorlevel 8 goto stageFailed
copy /y "%~f0" "%DEST%.staging\Uninstall.cmd" >nul || goto stageFailed
if exist "%MENU%" copy /y "%MENU%" "%DEST%.staging\previous-shortcut.lnk" >nul
"%SystemRoot%\System32\reg.exe" export "%ARP%" "%DEST%.staging\previous-registration.reg" /y >nul 2>nul
>"%DEST%.staging\.islandly-install" echo Islandly per-user install v1
if exist "%DEST%" move "%DEST%" "%DEST%.previous" >nul
if exist "%DEST%" goto stageFailed
move "%DEST%.staging" "%DEST%" >nul
if errorlevel 1 goto rollback
set "ACTIVATED=1"
set "STAGE=shortcut and registration"
if not exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs" mkdir "%APPDATA%\Microsoft\Windows\Start Menu\Programs"
rem Generate a local shortcut from serialized link data, not a downloaded executable/script.
"%SystemRoot%\System32\certutil.exe" -f -decodehex "%~dp0shortcut.hex" "%MENU%" 4 >nul || goto rollback
"%SystemRoot%\System32\reg.exe" add "%ARP%" /v DisplayName /t REG_SZ /d Islandly /f >nul || goto rollback
"%SystemRoot%\System32\reg.exe" add "%ARP%" /v DisplayVersion /t REG_SZ /d 0.4.0 /f >nul || goto rollback
"%SystemRoot%\System32\reg.exe" add "%ARP%" /v InstallLocation /t REG_SZ /d "%DEST%" /f >nul || goto rollback
"%SystemRoot%\System32\reg.exe" add "%ARP%" /v UninstallString /t REG_SZ /d "\"%SystemRoot%\System32\cmd.exe\" /d /c \"\"%DEST%\Uninstall.cmd\" /uninstall\"" /f >nul || goto rollback
"%SystemRoot%\System32\reg.exe" add "%ARP%" /v NoModify /t REG_DWORD /d 1 /f >nul || goto rollback
"%SystemRoot%\System32\reg.exe" add "%ARP%" /v NoRepair /t REG_DWORD /d 1 /f >nul || goto rollback
if exist "%DEST%.previous" rmdir /s /q "%DEST%.previous"
if exist "%DEST%\previous-shortcut.lnk" del /q "%DEST%\previous-shortcut.lnk"
if exist "%DEST%\previous-registration.reg" del /q "%DEST%\previous-registration.reg"
echo Installed. Settings preserved. / تم التثبيت مع الاحتفاظ بالإعدادات.
if /i "%~1"=="/quiet" exit /b 0
choice /c YN /n /m "Start with Windows? Y/N / تشغيل مع Windows؟ Y/N: "
if errorlevel 2 goto done
call "%~f0" /startup-on
:done
echo Start Islandly from the Start menu. / افتح Islandly من قائمة ابدأ.
if /i not "%~1"=="/quiet" pause
exit /b 0
:startupOn
if not exist "%DEST%\.islandly-install" goto failed
"%SystemRoot%\System32\reg.exe" add "%RUN%" /v Islandly /t REG_SZ /d "\"%DEST%\Islandly.exe\"" /f >nul || goto failed
echo Startup enabled. / تم تفعيل التشغيل مع Windows.
exit /b 0
:startupOff
"%SystemRoot%\System32\reg.exe" delete "%RUN%" /v Islandly /f >nul 2>nul
echo Startup disabled. / تم إيقاف التشغيل مع Windows.
exit /b 0
:uninstall
if not exist "%DEST%\.islandly-install" goto failed
echo Close Islandly first. This removes the app AND all settings and logs. / أغلق Islandly أولًا. سيتم حذف التطبيق وجميع الإعدادات والسجلات.
if /i "%~2"=="/quiet" goto remove
choice /c YN /n /m "Remove everything? Y/N / حذف الكل؟ Y/N: "
if errorlevel 2 exit /b 0
:remove
call :checkClosed
if errorlevel 1 exit /b 1
"%SystemRoot%\System32\reg.exe" delete "%RUN%" /v Islandly /f >nul 2>nul
"%SystemRoot%\System32\reg.exe" delete "%ARP%" /f >nul 2>nul
del /q "%MENU%" 2>nul
cd /d "%TEMP%"
(
 rmdir /s /q "%DEST%"
 if exist "%DEST%" exit /b 1
 if exist "%APPDATA%\islandly" rmdir /s /q "%APPDATA%\islandly"
 if exist "%APPDATA%\islandly" exit /b 1
 echo Removed. / تمت الإزالة.
 exit /b 0
)
:busy
echo Islandly is running. Quit it from the tray, then try again. / أغلق Islandly من الأيقونة ثم أعد المحاولة.
exit /b 1
:rollback
if defined ACTIVATED (
 if exist "%DEST%\previous-shortcut.lnk" (copy /y "%DEST%\previous-shortcut.lnk" "%MENU%" >nul) else (del /q "%MENU%" 2>nul)
 if exist "%DEST%\previous-registration.reg" ("%SystemRoot%\System32\reg.exe" import "%DEST%\previous-registration.reg" >nul) else ("%SystemRoot%\System32\reg.exe" delete "%ARP%" /f >nul 2>nul)
 rmdir /s /q "%DEST%"
)
if exist "%DEST%.previous" (
 if exist "%DEST%" rmdir /s /q "%DEST%"
 move "%DEST%.previous" "%DEST%" >nul
)
:stageFailed
if exist "%DEST%.staging" rmdir /s /q "%DEST%.staging"
:failed
echo Installation failed at %STAGE%; no security policy was changed. / تعذر التثبيت عند %STAGE%؛ لم يتم تغيير إعدادات الحماية.
exit /b 1

:checkClosed
"%SystemRoot%\System32\tasklist.exe" /fi "IMAGENAME eq Islandly.exe" /fi "USERNAME eq %USERDOMAIN%\%USERNAME%" /fo csv /nh | "%SystemRoot%\System32\findstr.exe" /i /c:"Islandly.exe" >nul
if not errorlevel 1 goto busy
exit /b 0
