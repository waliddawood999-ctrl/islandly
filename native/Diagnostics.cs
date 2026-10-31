using System;
using System.IO;
using System.Text;
static class NativeLog {
    static readonly object gate=new object();
    public static string Profile=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"islandly");
    public static void Write(string stage,Exception error) {
        var native=error as System.ComponentModel.Win32Exception;
        Write(stage,(native==null?"":"win32="+native.NativeErrorCode+" ("+new System.ComponentModel.Win32Exception(native.NativeErrorCode).Message+") ")+error.ToString());
    }
    public static void Write(string stage,string detail) {
        try { lock(gate) {
            Directory.CreateDirectory(Profile);
            string file=Path.Combine(Profile,"native-panels.log");
            if(File.Exists(file) && new FileInfo(file).Length>1048576) { if(File.Exists(file+".old")) File.Delete(file+".old"); File.Move(file,file+".old"); }
            File.AppendAllText(file,DateTime.UtcNow.ToString("o")+" "+stage+" "+detail+Environment.NewLine,new UTF8Encoding(false));
        } } catch { /* diagnostic failure must never become another UI exception */ }
    }
}
