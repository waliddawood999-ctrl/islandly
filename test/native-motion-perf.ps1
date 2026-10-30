param([ValidateSet('overlay','reserved-bar')][string]$Mode='overlay')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MotionInput {
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string cls,string text);
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr window,uint message,IntPtr a,IntPtr b);
}

public static class MotionProcessTree {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct ENTRY {public uint size,usage,id;public IntPtr heap;public uint module,threads,parent;public int priority;public uint flags;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)]public string name;}
 [DllImport("kernel32.dll",SetLastError=true)]static extern IntPtr CreateToolhelp32Snapshot(uint flags,uint id);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern bool Process32First(IntPtr snapshot,ref ENTRY entry);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern bool Process32Next(IntPtr snapshot,ref ENTRY entry);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr value);
 public static int[] Children(int owner){IntPtr snapshot=CreateToolhelp32Snapshot(2,0);if(snapshot==new IntPtr(-1))throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
  try {var children=new System.Collections.Generic.List<int>();ENTRY e=new ENTRY();e.size=(uint)Marshal.SizeOf(e);if(!Process32First(snapshot,ref e))throw new Exception("Cannot enumerate processes");do{if(e.parent==owner)children.Add((int)e.id);}while(Process32Next(snapshot,ref e));return children.ToArray();}finally{CloseHandle(snapshot);}}
}
'@
$probe=Join-Path $env:TEMP ('Islandly-motion-perf-'+[guid]::NewGuid());$profile=Join-Path $probe 'profile'
New-Item $profile -ItemType Directory -Force|Out-Null
$configuration=@{idleEyes=$true;floating=$true;motion='full';ecoMode=$false;ecoAuto=$false;autoHide='never';uiLang='en';scale=1;islandMode=if($Mode-eq 'reserved-bar'){'appbar'}else{'overlay'};weather=$false;updates=$false;breakEvery=0;timeTracking=$false;prayerAlerts=$false;hideFullscreen=$true}
function Save-Settings {$configuration|ConvertTo-Json|Set-Content "$profile/settings.json" -Encoding utf8}
Save-Settings
$hostProcess=Start-Process "$root/native/bin/Islandly.exe" -ArgumentList @('--root',('"'+$root+'"'),'--profile',('"'+$profile+'"'),'--probe-dir',('"'+$probe+'"'),'--mode',$Mode,'--motion-metrics','--quiet-probe') -PassThru
$owned=[Collections.Generic.HashSet[int]]::new()
$ast=[Management.Automation.Language.Parser]::ParseFile("$root/test/native-footprint.ps1",[ref]$null,[ref]$null)
foreach($name in @('Read-SharedJson','Read-Status')){$node=$ast.Find({param($n)$n-is [Management.Automation.Language.FunctionDefinitionAst]-and $n.Name-eq $name},$true);. ([scriptblock]::Create($node.Extent.Text))}
function Refresh {[void][MotionInput]::SendMessage(([MotionInput]::FindWindow($null,'Islandly Native')),0x8022,[IntPtr]::Zero,[IntPtr]::Zero)}
function Quantile($values,$q){$ordered=@($values|Sort-Object);return $ordered[[Math]::Min($ordered.Count-1,[Math]::Floor($q*$ordered.Count))]}
function Phase($name,$moving){
 Refresh;$before=Read-Status
 Start-Sleep -Seconds 15;$samples=@();$watch=[Diagnostics.Stopwatch]::StartNew();$next=1000
 $hostProcess.Refresh();$lastCpu=$hostProcess.TotalProcessorTime.TotalMilliseconds;$lastTime=$watch.Elapsed.TotalMilliseconds
 for($i=0;$i-lt 60;){
  if($moving){$t=$watch.Elapsed.TotalSeconds;[Windows.Forms.Cursor]::Position=[Drawing.Point]::new([int]($center+110*[Math]::Sin($t*2)),[int]($top+100+15*[Math]::Cos($t*2)))}
  if($watch.ElapsedMilliseconds-ge $next){
   $hostProcess.Refresh();if($hostProcess.HasExited){throw 'Native host exited'}
   if([MotionProcessTree]::Children($hostProcess.Id).Length-ne 0){throw 'Native idle started a child process'}
   $now=$watch.Elapsed.TotalMilliseconds;$total=$hostProcess.TotalProcessorTime.TotalMilliseconds;$cpu=($total-$lastCpu)/($now-$lastTime)*100
   $samples+=@{totalMB=$hostProcess.WorkingSet64/1048576.0;totalCPU=$cpu;pid=$hostProcess.Id};$lastCpu=$total;$lastTime=$now;$i++;$next+=1000
  }
  Start-Sleep -Milliseconds 30
 }
 Refresh;$after=Read-Status
 if(@($after.processes).Count-ne 1-or $after.phase-ne 'idle'){throw 'Native idle retained an owned process'}
 $avg=($samples|ForEach-Object{$_.totalMB}|Measure-Object -Average).Average;$cpu=($samples|ForEach-Object{$_.totalCPU}|Measure-Object -Average).Average;$peak=($samples|ForEach-Object{$_.totalMB}|Measure-Object -Maximum).Maximum
 if($peak-ge 180){throw "$name RAM exceeds180 MB"}
 $limit=if($moving){.5}else{.1};if($cpu-ge $limit){throw "$name CPU $cpu exceeds $limit% of one core"}
 if(!$moving-and $after.motion.cursorReads-ne $before.motion.cursorReads){throw "$name polled a far/hidden cursor"}
 Write-Output "NATIVE MOTION PERF: $Mode $name RAM avg=$avg peak=$peak MB; CPU=$cpu%; cursorReads=$($after.motion.cursorReads-$before.motion.cursorReads)"
 return @{name=$name;averageMB=$avg;peakMB=$peak;averageCPU=$cpu;samples=$samples;before=$before.motion;after=$after.motion;method='external process CPU/working set,15s warmup/60samples; diagnostic status disk writes disabled; Toolhelp child detection; original T9 JobObject full guards remain separate'}
}

try{
 $deadline=[DateTime]::UtcNow.AddSeconds(20);while(!(Test-Path "$probe/status.json")){if($hostProcess.HasExited-or [DateTime]::UtcNow-gt $deadline){throw 'Native motion host did not start'};Start-Sleep -Milliseconds 100}
 $initial=Read-Status;$center=$initial.motion.center;$top=$initial.motion.top
 [Windows.Forms.Cursor]::Position=[Drawing.Point]::new([int]$center,[int]($top+400));Start-Sleep -Seconds 2
 $idle=Phase 'eyes-idle' $false
 [Windows.Forms.Cursor]::Position=[Drawing.Point]::new([int]$center,[int]($top+18));Start-Sleep -Milliseconds 150
 $moving=Phase 'eyes-moving' $true
 if($moving.after.cursorReads-$moving.before.cursorReads-lt 600){throw 'Moving eyes did not actually poll/track the near cursor'}
 [Windows.Forms.Cursor]::Position=[Drawing.Point]::new([int]$center,[int]($top+400));Start-Sleep -Seconds 2
 $configuration.ecoMode=$true;Save-Settings;Refresh
 $hidden=Phase 'eyes-hidden' $false
 if((Read-Status).motion.eyesVisible-or (Read-Status).motion.cursorTimer){throw 'Eco did not remove eyes and their timers'}
 $configuration.ecoMode=$false;Save-Settings;Refresh
 # Real Win32 message dispatch: input timestamp is captured at UI dispatch, never at a later timer.
 $frames=@();$inputs=@()
 for($n=0;$n-lt 12;$n++){
  [void][MotionInput]::SendMessage(([MotionInput]::FindWindow($null,'Islandly Native')),0x8021,[IntPtr]1,[IntPtr]::Zero);Start-Sleep -Milliseconds 340;Refresh
  $frames+=Get-Content "$probe/motion-frames.json" -Raw|ConvertFrom-Json;$inputs+=(Read-Status).motion.inputFirstMs
  [void][MotionInput]::SendMessage(([MotionInput]::FindWindow($null,'Islandly Native')),0x8021,[IntPtr]::Zero,[IntPtr]::Zero);Start-Sleep -Milliseconds 340
 }
 $active=@($frames|Where-Object {$_.body-gt .01-and $_.body-lt .99-and $_.interval-gt 0})
 if($active.Count-lt 100){throw 'Insufficient native motion frames'}
 $p50=Quantile $active.interval .5;$p95=Quantile $active.interval .95;$cpu=($active|Measure-Object cpuMs -Average).Average;$response=($inputs|Measure-Object -Maximum).Maximum
 # DWM's nominal60 Hz period is16.667ms. Retain every raw interval and fail missed budgets.
 $late=@($active|Where-Object {$_.interval-gt 16.667}).Count
 if($p95-gt 16.667-or $response-ge 50-or $cpu-ge 2){throw "Native motion failed60fps/input/CPU: p95=$p95 response=$response cpu=$cpu late=$late"}
 New-Item "$root/out/t21" -ItemType Directory -Force|Out-Null
 @{mode=$Mode;idle=$idle;moving=$moving;hidden=$hidden;liquid=@{frameP50=$p50;frameP95=$p95;lateFrames=$late;frameCpuAverageMs=$cpu;inputMaxMs=$response;inputSamples=$inputs;frames=$frames};hardware='Windows CI single monitor; laptop SAC/second physical monitor/144Hz not run'}|ConvertTo-Json -Depth 14|Set-Content "$root/out/t21/perf-$Mode.json" -Encoding utf8
 Write-Output "NATIVE LIQUID: $Mode frame p50/p95=$p50/$p95 ms, CPU mean=$cpu ms/frame, input max=$response ms, >16.667ms=$late"
}finally{
 if(!$hostProcess.HasExited){Set-Content "$probe/command.txt" 'exit';if(!$hostProcess.WaitForExit(10000)){$hostProcess.Kill()}}
 New-Item "$root/out/t21/logs-$Mode" -ItemType Directory -Force|Out-Null
 Copy-Item "$profile/*.log","$probe/status.json","$probe/motion-frames.json" "$root/out/t21/logs-$Mode" -Force -ErrorAction SilentlyContinue
}
