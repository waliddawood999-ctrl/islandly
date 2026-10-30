using System;
using System.IO;
using System.Text;
using System.ComponentModel;
using System.Runtime.InteropServices;

// Same-volume rename replaces the directory entry in one operation. ReplaceFileW
// (File.Replace) can temporarily remove the destination during its multi-step swap.
public static class NativeStatusPublication {
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool MoveFileEx(string source,string destination,uint flags);
    public static void Publish(string file,string snapshot) {
        string temporary=file+".tmp";
        byte[] bytes=new UTF8Encoding(false).GetBytes(snapshot);
        using(var stream=new FileStream(temporary,FileMode.Create,FileAccess.Write,FileShare.ReadWrite|FileShare.Delete)) {
            stream.Write(bytes,0,bytes.Length);stream.Flush(true);
        }
        // MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH; no delete-first gap,
        // no existence check, and readers may retain the previous complete file.
        if(!MoveFileEx(temporary,file,0x1|0x8)) {
            int error=Marshal.GetLastWin32Error();
            throw new IOException("Atomic ownership publication failed (Win32 "+error+")",new Win32Exception(error));
        }
    }
}
