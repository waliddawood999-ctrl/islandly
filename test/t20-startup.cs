using System;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
static class T20Fixture {
 [DllImport("user32.dll",SetLastError=true)] static extern bool RegisterHotKey(IntPtr h,int id,uint mods,uint key);
 static void Main(string[] args) {
  if(args.Length>0 && args[0]=="block") {
   if(!RegisterHotKey(IntPtr.Zero,99,0x4003,0x49)) throw new Exception("Cannot reserve primary hotkey");
   File.WriteAllText(args[1],"ready");Thread.Sleep(120000);return;
  }
  using(var pipe=new NamedPipeClientStream(".",Environment.GetEnvironmentVariable("ISLANDLY_NATIVE_PIPE"),PipeDirection.InOut)) {
   pipe.Connect(10000);
   using(var writer=new StreamWriter(pipe,new UTF8Encoding(false),1024,true)) using(var reader=new StreamReader(pipe)) {
    writer.AutoFlush=true;
    Thread.Sleep(32000); // first panel intentionally slower than the old ready timeout
    writer.WriteLine("ISLANDLY:ready:");
    string line;while((line=reader.ReadLine())!=null)if(line=="close"){writer.WriteLine("ISLANDLY:idle:");return;}
   }
  }
 }
}
