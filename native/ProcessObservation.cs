using System;
using System.ComponentModel;
using System.Diagnostics;
// A PID can disappear between the JobObject snapshot and ANY property read.
// Return a complete immutable observation or none; never commit partial totals.
sealed class NativeProcessObservation {
 public readonly int Id;public readonly string Name;public readonly double MemoryMB,CpuMilliseconds;
 public NativeProcessObservation(int id,string name,double memory,double cpu){Id=id;Name=name;MemoryMB=memory;CpuMilliseconds=cpu;}
 public static NativeProcessObservation Capture(Func<NativeProcessObservation> read){
  try{return read();}catch(ArgumentException){return null;}catch(InvalidOperationException){return null;}
  catch(Win32Exception e){if(e.NativeErrorCode==6||e.NativeErrorCode==87||e.NativeErrorCode==1168)return null;throw;}
 }
 public static NativeProcessObservation Read(int id){return Capture(delegate{using(var p=Process.GetProcessById(id)){if(p.HasExited)return null;return new NativeProcessObservation(id,p.ProcessName,p.WorkingSet64/1048576.0,p.TotalProcessorTime.TotalMilliseconds);}});}
}
