# Test production metadata capture without timing-dependent PID churn.
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Add-Type ((Get-Content "$root/native/ProcessObservation.cs" -Raw)+@'
public static class ProcessObservationTest {
 static double CpuAfterExit(){throw new System.InvalidOperationException("Process has exited after memory was read");}
 public static void Run(){
  bool memoryRead=false;
  System.Func<double> memory=()=>{memoryRead=true;return 123;};
  var partial=NativeProcessObservation.Capture(()=>new NativeProcessObservation(42,"exited",memory(),CpuAfterExit()));
  if(!memoryRead||partial!=null)throw new System.Exception("Partial process sample escaped after exit");
  if(NativeProcessObservation.Capture(()=>{throw new System.ArgumentException("PID already reaped");})!=null)throw new System.Exception("Missing PID was retained");
  foreach(int error in new[]{6,87,1168})if(NativeProcessObservation.Capture(()=>{throw new System.ComponentModel.Win32Exception(error);})!=null)throw new System.Exception("Exited process handle was retained");
  bool denied=false;try{NativeProcessObservation.Capture(()=>{throw new System.ComponentModel.Win32Exception(5);});}catch(System.ComponentModel.Win32Exception e){denied=e.NativeErrorCode==5;}
  if(!denied)throw new System.Exception("Real access-denied error was swallowed");
  using(var self=System.Diagnostics.Process.GetCurrentProcess()){
   var live=NativeProcessObservation.Read(self.Id);
   if(live==null||live.Id!=self.Id||string.IsNullOrEmpty(live.Name)||live.MemoryMB<=0||live.CpuMilliseconds<0)throw new System.Exception("Live owned process was omitted");
  }
  // Signed Windows command interpreter, no new helper binary.
  using(var ended=System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("cmd.exe","/c exit 0"){UseShellExecute=false,CreateNoWindow=true})){
   int id=ended.Id;if(!ended.WaitForExit(5000)){ended.Kill();throw new System.Exception("Exit fixture hung");}
   if(NativeProcessObservation.Read(id)!=null)throw new System.Exception("Reaped process was included");
  }
 }
}
'@)
[ProcessObservationTest]::Run()
Write-Output 'PROCESS OBSERVATION PASS: exit after memory read returns no partial sample; live owned PID retained; reaped/invalid handles omitted; access-denied remains an error'
