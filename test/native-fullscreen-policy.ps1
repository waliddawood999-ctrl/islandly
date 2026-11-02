$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Add-Type -AssemblyName System.Drawing
Add-Type ((Get-Content "$root/native/Fullscreen.cs" -Raw)+@'
public static class FullscreenPolicyTests {
 static void Check(bool value,string why){if(!value)throw new System.Exception(why);}
 public static void Run(){
  var monitor=new System.Drawing.Rectangle(-1920,-200,1920,1080);
  var o=new FullscreenObservation{window=(System.IntPtr)5,process=42,valid=true,frame=monitor,monitor=monitor,monitorName="secondary"};
  Check(o.Fullscreen,"Fullscreen secondary monitor, negative coordinates");
  Check(!o.HideIsland(true,"primary")&&o.HideIsland(true,"secondary"),"Monitor-scoped island hiding");
  Check(!o.HideIsland(false,"secondary")&&o.Fullscreen,"Disabling island hiding must not enable eyes in fullscreen");
  o.owned=true;Check(!o.Fullscreen,"Own host/panel HWND");o.owned=false;
  o.cloaked=true;Check(!o.Fullscreen,"Cloaked HWND");o.cloaked=false;
  o.minimized=true;Check(!o.Fullscreen,"Minimized HWND");o.minimized=false;
  o.caption=o.maximized=true;Check(!o.Fullscreen,"Maximized captioned window is not fullscreen");o.caption=o.maximized=false;
  o.frame=new System.Drawing.Rectangle(-1920,-180,1920,1060);o.shellState=2;
  Check(!o.Fullscreen,"QUNS_BUSY cannot turn an ordinary near-full window into fullscreen");
  o.shellState=3;Check(o.Fullscreen,"Near-full exclusive D3D");o.shellState=4;Check(o.Fullscreen,"Near-full presentation");
  o.frame=new System.Drawing.Rectangle(-1900,-100,500,400);Check(!o.Fullscreen,"Global shell state cannot classify a small foreground window");
  o.frame=monitor;o.className="Shell_SecondaryTrayWnd";Check(!o.Fullscreen,"Secondary shell window");o.className="";
  o.valid=false;Check(!o.Fullscreen,"Failed native capture");o.valid=true;
  int reads=0;System.IntPtr hwnd=(System.IntPtr)5;
  var cache=new FullscreenCache(()=>hwnd,h=>{reads++;return new FullscreenObservation{window=h,valid=true,monitor=monitor,frame=o.frame,monitorName="secondary"};});
  Check(cache.Read().Fullscreen,"Initial cached fullscreen");
  for(int i=0;i<1000;i++)cache.Read();Check(reads==1,"Pointer/status work must not query DWM/shell again");
  o.frame=new System.Drawing.Rectangle(-1900,-100,500,400);cache.Invalidate();
  Check(!cache.Read().Fullscreen&&reads==2,"Same-HWND resize is visible immediately, without a500ms stale result");
  hwnd=(System.IntPtr)7;cache.Read();Check(reads==3,"Foreground HWND switch is never cached across windows");
  o.frame=monitor;cache.Invalidate();Check(cache.Read().Fullscreen,"Fullscreen entry after same-HWND resize");
 }
}
'@)
[FullscreenPolicyTests]::Run()
Write-Output 'FULLSCREEN POLICY PASS: own/shell/minimized/cloaked/maximized, geometry, D3D/presentation vs busy, negative secondary monitor, immediate same-HWND invalidation, policy-independent cached facts'
