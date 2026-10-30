# Real native/AppBar + on-demand Electron settings, using the exact measurement reader.
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$probe=Join-Path $env:TEMP ('Islandly-status-live-'+[guid]::NewGuid())
$profile=Join-Path $probe 'profile';$Mode='live-appbar'
New-Item $profile -ItemType Directory -Force|Out-Null
[IO.File]::WriteAllText("$profile/settings.json",(@{weather=$false;updates=$false;breakEvery=0;timeTracking=$false;prayerAlerts=$false;hideFullscreen=$false;islandMode='appbar'}|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
$owned=[Collections.Generic.HashSet[int]]::new()
$ast=[Management.Automation.Language.Parser]::ParseFile("$root/test/native-footprint.ps1",[ref]$null,[ref]$null)
foreach($name in @('Read-SharedJson','Read-Status')) {
 $node=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
 . ([scriptblock]::Create($node.Extent.Text))
}
$hostProcess=Start-Process "$root/native/bin/Islandly.exe" -ArgumentList @('--root',('"'+$root+'"'),'--profile',('"'+$profile+'"'),'--probe-dir',('"'+$probe+'"'),'--mode','reserved-bar') -PassThru
function Command($value){Set-Content "$probe/command.tmp" $value -NoNewline;Move-Item "$probe/command.tmp" "$probe/command.txt" -Force}
function Phase($phase){$end=[DateTime]::UtcNow.AddSeconds(40);do{if(Test-Path "$probe/status.json"){$s=Read-Status;if($s.phase-eq $phase){return $s}};Start-Sleep -Milliseconds 50}while([DateTime]::UtcNow-lt $end);throw "Timed out: $phase"}
try {
 [void](Phase 'idle');Command 'settings';[void](Phase 'panel')
 $end=[DateTime]::UtcNow.AddSeconds(75);$reads=0;$script:statusReadWarnings=0
 do {
  $s=Read-Status
  if($s.phase-ne 'panel'-or !$s.appBar-or @($s.processes).Count-lt 2){throw 'Live ownership snapshot lost the panel/AppBar or owned processes'}
  $sum=($s.processes|Measure-Object mb -Sum).Sum
  if([Math]::Abs($sum-$s.totalMB)-gt 0.00001){throw 'Live total omits an owned process'}
  $reads++;Start-Sleep -Milliseconds 1
 }while([DateTime]::UtcNow-lt $end)
 if($script:statusReadWarnings-ne 0){throw 'Live atomic status read required retries'}
 Command 'close';$closed=Phase 'idle'
 if(@($closed.processes).Count-ne 1){throw 'Electron survived panel close'}
 Write-Output "LIVE STATUS PASS: $reads strict reads during75s of actual AppBar settings ownership, then native-only idle"
}finally{
 New-Item "$root/out/status-live" -ItemType Directory -Force|Out-Null
 Copy-Item "$profile/*.log","$probe/status.json" "$root/out/status-live" -Force -ErrorAction SilentlyContinue
 if(!$hostProcess.HasExited){Command 'exit';if(!$hostProcess.WaitForExit(10000)){$hostProcess.Kill()}}
 foreach($id in $owned){if(Get-Process -Id $id -ErrorAction SilentlyContinue){throw "Owned PID $id leaked"}}
}
