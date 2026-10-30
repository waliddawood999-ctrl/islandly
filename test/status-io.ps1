# Exercise the actual probe reader against the same atomic replace publication protocol.
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$probe=Join-Path $env:TEMP ('Islandly-status-io-'+[guid]::NewGuid())
New-Item $probe -ItemType Directory|Out-Null
$hostProcess=[Diagnostics.Process]::GetCurrentProcess()
$owned=[Collections.Generic.HashSet[int]]::new()
$Mode='status-io'
$ast=[Management.Automation.Language.Parser]::ParseFile("$root/test/native-footprint.ps1",[ref]$null,[ref]$null)
foreach($name in @('Read-SharedJson','Read-Status')) {
 $node=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
 if(!$node){throw "Missing actual reader function $name"}
 . ([scriptblock]::Create($node.Extent.Text))
}
$publisherSource=Get-Content "$root/native/StatusPublication.cs" -Raw
Add-Type ($publisherSource + @'
public static class StatusPublication {
 static readonly System.Threading.ManualResetEvent progress=new System.Threading.ManualResetEvent(false);
 public static bool WaitForProgress(){return progress.WaitOne(10000);}
 public static int Published,Busy; public static Exception Failure; static volatile bool stopped,released; static System.Threading.Thread writer;
 public static void Start(string file,int pid) {
  stopped=false;released=false;Failure=null;Published=Busy=0;progress.Reset();
  writer=new System.Threading.Thread(()=>{try{int n=7;while(!stopped){
   string processes="{\"pid\":"+pid+",\"mb\":40,\"cpu\":0}";
   for(int i=1;i<=n%8;i++)processes+=",{\"pid\":"+(pid+i)+",\"mb\":50,\"cpu\":0.125}";
   string data="{\"hostPid\":"+pid+",\"phase\":\"panel\",\"generation\":"+n+",\"processes\":["+processes+"]}";
   try { NativeStatusPublication.Publish(file,data); Published++; if(Published>=20)progress.Set(); if(n==7)while(!released&&!stopped)System.Threading.Thread.Sleep(1); n++; } catch(IOException) { Busy++; }
   System.Threading.Thread.Sleep(1);
  }}catch(Exception e){Failure=e;}});writer.IsBackground=true;writer.Start();
 }
 public static void Continue(){released=true;}
 public static void Stop(){stopped=true;if(writer!=null)writer.Join();if(Failure!=null)throw Failure;}
}
'@)
try {
 [StatusPublication]::Start("$probe/status.json",$hostProcess.Id)
 $deadline=[DateTime]::UtcNow.AddSeconds(10)
 while(!(Test-Path "$probe/status.json")){if([DateTime]::UtcNow-gt $deadline){throw 'Publisher never started'};Start-Sleep -Milliseconds 10}
 $first=Read-Status
 if(@($first.processes).Count-ne 8){throw 'Initial full ownership fixture was truncated'}
 [StatusPublication]::Continue()
 # Explicit writer readiness, not a speed race between2000 reads and20 fsyncs.
 # The existing20-publication progress requirement and zero-retry reader remain.
 if(![StatusPublication]::WaitForProgress()){throw 'Publisher did not reach20 complete publications'}
 $last=-1
 $script:statusReadWarnings=0
 for($n=0;$n-lt 2000;$n++) {
  $s=Read-Status
  if($s.generation-lt $last){throw 'Snapshot generation went backwards'}
  if(@($s.processes).Count-ne 1+$s.generation%8){throw 'Partial snapshot or omitted owned processes'}
  $last=$s.generation
 }
 if($script:statusReadWarnings-ne 0){throw 'Atomic publication required read retries'}
 if($owned.Count-lt 8){throw 'Full process ownership not retained'}
 if([StatusPublication]::Published-lt 20){throw 'Publisher did not make progress'}
 Write-Output "STATUS IO PASS:2000 strict ownership reads; zero read retries; $([StatusPublication]::Published) complete publications, $([StatusPublication]::Busy) busy publication attempts left the previous snapshot intact"
} finally {[StatusPublication]::Stop();Remove-Item $probe -Recurse -Force}
