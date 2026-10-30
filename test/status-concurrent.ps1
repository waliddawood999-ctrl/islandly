# Real production publisher, concurrent writers, and readers that retain old snapshots.
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Add-Type ((Get-Content "$root/native/StatusPublication.cs" -Raw)+@'
public static class ConcurrentPublicationTest {
 public static void Run(string file){
  var start=new System.Threading.ManualResetEvent(false);var threads=new System.Threading.Thread[6];
  var errors=new System.Collections.Concurrent.ConcurrentQueue<System.Exception>();
  string[] expected=new string[6];for(int i=0;i<6;i++)expected[i]="{\"writer\":"+i+",\"payload\":\""+new string((char)('a'+i),65536+i*997)+"\"}";
  // Deterministic shared-.tmp collision: another publisher can retain its staging
  // handle across the rename. It must never be able to mutate the public snapshot.
  string shared=file+".tmp";
  using(var stale=new System.IO.FileStream(shared,System.IO.FileMode.Create,System.IO.FileAccess.Write,System.IO.FileShare.ReadWrite|System.IO.FileShare.Delete)){
   NativeStatusPublication.Publish(file,expected[0]);
   byte[] corrupt=System.Text.Encoding.UTF8.GetBytes("CORRUPTED");stale.Position=0;stale.Write(corrupt,0,corrupt.Length);stale.Flush(true);
   if(System.IO.File.ReadAllText(file)!=expected[0])throw new System.Exception("A retained staging handle modified the published snapshot");
  }
  System.IO.File.Delete(shared);
  NativeStatusPublication.Publish(file,expected[0]);
  // An open old handle must keep its complete snapshot while names are replaced.
  using(var held=new System.IO.FileStream(file,System.IO.FileMode.Open,System.IO.FileAccess.Read,System.IO.FileShare.ReadWrite|System.IO.FileShare.Delete)){
   for(int i=0;i<threads.Length;i++){int index=i;threads[i]=new System.Threading.Thread(()=>{start.WaitOne();for(int n=0;n<80;n++)try{NativeStatusPublication.Publish(file,expected[index]);}catch(System.IO.IOException){}catch(System.Exception e){errors.Enqueue(e);}});threads[i].Start();}
   start.Set();
   for(int n=0;n<2000;n++){
    string snapshot;using(var stream=new System.IO.FileStream(file,System.IO.FileMode.Open,System.IO.FileAccess.Read,System.IO.FileShare.ReadWrite|System.IO.FileShare.Delete))using(var reader=new System.IO.StreamReader(stream))snapshot=reader.ReadToEnd();
    if(System.Array.IndexOf(expected,snapshot)<0)throw new System.Exception("Mixed/truncated snapshot from concurrent publishers");
   }
   foreach(var thread in threads)thread.Join();
   using(var reader=new System.IO.StreamReader(held))if(reader.ReadToEnd()!=expected[0])throw new System.Exception("Retained snapshot was mutated in place");
  }
  System.Exception failure;if(errors.TryDequeue(out failure))throw failure;
 }
}
'@)
$dir=Join-Path $env:TEMP ('Islandly-concurrent-status-'+[guid]::NewGuid());New-Item $dir -ItemType Directory|Out-Null
try{[ConcurrentPublicationTest]::Run("$dir/status.json");if(@(Get-ChildItem $dir -Filter '*.tmp').Count){throw 'Publication temporary files leaked'};Write-Output 'STATUS CONCURRENT PASS: six publishers,2000 exact complete snapshots, retained old handle, zero read retries and zero leaked temporary files'}finally{Remove-Item $dir -Recurse -Force}
