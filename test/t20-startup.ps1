$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$tool=& "$root/scripts/native-toolchain.ps1"
$dir=Join-Path $env:TEMP ('Islandly T20 '+[guid]::NewGuid())
New-Item $dir -ItemType Directory|Out-Null
$fixture=Join-Path $dir 'delayed.exe'
$refs=@('mscorlib','System','System.Core')|ForEach-Object {'/reference:'+(Join-Path $tool.references ($_+'.dll'))}
& $tool.compiler /nologo /noconfig /nostdlib+ /target:exe "/out:$fixture" $refs "$root/test/t20-startup.cs"
if($LASTEXITCODE-ne 0){throw 'Fixture compile failed'}
$blocker=$null;$hostProcess=$null
function Status {try {Get-Content "$dir/status.json" -Raw|ConvertFrom-Json}catch{$null}}
function Command($text){Set-Content "$dir/command.tmp" $text -NoNewline;Move-Item "$dir/command.tmp" "$dir/command.txt" -Force}
function Until($fn,$label,$seconds=20){$end=[DateTime]::UtcNow.AddSeconds($seconds);do{if(&$fn){return};Start-Sleep -Milliseconds 100}while([DateTime]::UtcNow-lt $end);throw "Timed out: $label"}
try {
 $blocker=Start-Process $fixture -ArgumentList @('block',('"'+"$dir/block-ready"+'"')) -PassThru -WindowStyle Hidden
 Until {Test-Path "$dir/block-ready"} 'hotkey blocker'
 $hostProcess=Start-Process "$root/native/bin/Islandly.exe" -ArgumentList @('--root',('"'+$root+'"'),'--electron',('"'+$fixture+'"'),'--profile',('"'+"$dir/profile"+'"'),'--probe-dir',('"'+$dir+'"'),'--launch-delay-ms','32000') -PassThru
 Until {(Status).phase-eq'idle'} 'native idle'
 if((Status).hotkey-ne'Ctrl+Alt+Shift+I'){throw 'Hotkey conflict did not select fallback'}
 Command 'expand'
 Until {(Status).phase-eq'starting'} 'loading'
 $first=Get-Item "$dir/status.json"
 Start-Sleep -Seconds 3
 if((Get-Item "$dir/status.json").LastWriteTimeUtc-le $first.LastWriteTimeUtc){throw 'Native UI/status blocked during slow CreateProcess simulation'}
 Until {(Status).phase-eq'panel'} '32s create delay +32s first-ready' 85
 $s=Status
 if($s.processStartedMs-$s.requestMs-lt 32000){throw 'Ready timer started before process resume'}
 $log=Get-Content "$dir/profile/native-panels.log" -Raw
 if($log-notmatch 'loading-paint.*inputToPaintMs=([0-9]+)'){throw 'Native loading feedback not painted'}
 if([int]$Matches[1]-ge 50){Write-Output ('LOADING FEEDBACK DIAGNOSTIC: '+(($log-split"`n")|Where-Object{$_-match 'loading-paint|fullscreen-check|hover|launch|expand'}|Select-Object -First 12)-join ' | ');throw "Native loading feedback $($Matches[1]) ms exceeds 50 ms"}
 Command 'close';Until {(Status).phase-eq'idle'} 'all panel processes gone'
 if(@((Status).processes).Count-ne 1){throw 'Delayed panel process leaked'}
 Write-Output "T20 STARTUP PASS: responsive UI during32s create delay, timer after ResumeThread, first-ready after32s, primary conflict/fallback, loading paint under50ms, full shutdown"
}finally{
 if($hostProcess-and !$hostProcess.HasExited){Command 'exit';if(!$hostProcess.WaitForExit(5000)){$hostProcess.Kill()}}
 if($blocker-and !$blocker.HasExited){$blocker.Kill()}
 New-Item "$root/out/t20-startup" -ItemType Directory -Force|Out-Null
 Copy-Item "$dir/profile/native-panels.log","$dir/status.json" "$root/out/t20-startup" -ErrorAction SilentlyContinue
}
