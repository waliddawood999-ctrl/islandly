$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$out=Join-Path $root 'native/bin'
New-Item $out -ItemType Directory -Force|Out-Null
$vswhere=Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
$installation=& $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if(!$installation){throw 'Windows native motion requires the installed Visual C++ x64 build tools'}
$vcvars=Join-Path $installation 'VC/Auxiliary/Build/vcvars64.bat'
Push-Location $out
try {
 $source=Join-Path $root 'native/motion/Renderer.cpp'
 $model=Join-Path $root 'native/motion/Model.test.cpp'
 # /MT adds no VC runtime DLL dependency; /Brepro removes timestamp nondeterminism.
 $command='"'+$vcvars+'" >nul && cl /nologo /std:c++17 /EHsc /O2 /MT /Brepro /LD "'+$source+'" /Fe:Islandly.Motion.dll /link /Brepro d2d1.lib d3d11.lib dxgi.lib dcomp.lib dwrite.lib dwmapi.lib windowscodecs.lib ole32.lib user32.lib gdi32.lib'
 & cmd.exe /d /s /c $command
 if($LASTEXITCODE-ne 0){throw 'Direct2D/DirectComposition native renderer compilation failed'}
 $command='"'+$vcvars+'" >nul && cl /nologo /std:c++17 /EHsc /O2 /MT "'+$model+'" /Fe:MotionModelTest.exe && MotionModelTest.exe'
 & cmd.exe /d /s /c $command
 if($LASTEXITCODE-ne 0){throw 'Production native motion model tests failed'}
}finally{Pop-Location}
