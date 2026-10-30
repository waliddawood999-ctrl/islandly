$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$tool=& "$root/scripts/native-toolchain.ps1"
$refs=@('mscorlib','System','System.Core','System.Drawing','System.Windows.Forms','System.Web.Extensions')|ForEach-Object{'/reference:'+(Join-Path $tool.references ($_+'.dll'))}
$exe=Join-Path $root 'native/bin/NativeMotionQa.exe'
& $tool.compiler /nologo /noconfig /nostdlib+ /langversion:7.3 /target:exe "/out:$exe" $refs "$root/native/Motion.cs" "$root/test/native-motion-qa.cs"
if($LASTEXITCODE-ne 0){throw 'Native screenshot harness compilation failed'}
& $exe "$root/out/t21/screenshots"
if($LASTEXITCODE-ne 0){throw 'Native screenshots/geometry failed'}
