using System;
using System.Runtime.InteropServices;
// Native acrylic: no Chromium or helper process. The Form's pill Region clips the backdrop.
static class NativeMaterial {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct VERSION { public uint size,major,minor,build,platform; [MarshalAs(UnmanagedType.ByValTStr,SizeConst=128)] public string service; }
    [StructLayout(LayoutKind.Sequential)] struct ACCENT { public int state,flags; public uint color; public int animation; }
    [StructLayout(LayoutKind.Sequential)] struct DATA { public int attribute; public IntPtr data; public int size; }
    [StructLayout(LayoutKind.Sequential)] struct MARGINS { public int left,right,top,bottom; }
    [DllImport("ntdll.dll",CharSet=CharSet.Unicode)] static extern int RtlGetVersion(ref VERSION value);
    [DllImport("user32.dll")] static extern bool SetWindowCompositionAttribute(IntPtr hwnd,ref DATA data);
    [DllImport("dwmapi.dll")] static extern int DwmExtendFrameIntoClientArea(IntPtr hwnd,ref MARGINS margins);
    public static bool Supported() { try { var v=new VERSION(); v.size=(uint)Marshal.SizeOf(v); return RtlGetVersion(ref v)==0 && v.build>=22000; } catch { return false; } }
    public static bool Apply(IntPtr hwnd,bool acrylic) {
        IntPtr memory=IntPtr.Zero;
        try {
            if(acrylic && !Supported()) return false;
            var accent=new ACCENT { state=acrylic?4:0,flags=2,color=0xcc101010 };
            memory=Marshal.AllocHGlobal(Marshal.SizeOf(accent)); Marshal.StructureToPtr(accent,memory,false);
            var data=new DATA { attribute=19,data=memory,size=Marshal.SizeOf(accent) };
            bool ok=SetWindowCompositionAttribute(hwnd,ref data);
            var margins=new MARGINS { left=acrylic?-1:0,right=acrylic?-1:0,top=acrylic?-1:0,bottom=acrylic?-1:0 };
            return DwmExtendFrameIntoClientArea(hwnd,ref margins)==0 && ok;
        } catch { return false; }
        finally { if(memory!=IntPtr.Zero) Marshal.FreeHGlobal(memory); }
    }
}
