using System;
using System.Drawing;

// Platform observations are captured once per foreground/location event, not on
// pointer ticks. Policy/monitor selection never enters the cached observation.
sealed class FullscreenObservation {
 public IntPtr window; public uint process; public string className="",monitorName="";
 public Rectangle frame,monitor; public bool valid,owned,visible=true,minimized,cloaked,caption,maximized; public int shellState;
 public bool NearMonitor {get{long area=(long)monitor.Width*monitor.Height;Rectangle overlap=Rectangle.Intersect(frame,monitor);return valid&&area>0&&(long)Math.Max(0,overlap.Width)*Math.Max(0,overlap.Height)*10>=area*9;}}
 public bool Fullscreen {get{
  if(!valid||window==IntPtr.Zero||owned||!visible||minimized||cloaked||maximized&&caption||className=="Progman"||className=="WorkerW"||className=="Shell_TrayWnd"||className=="Shell_SecondaryTrayWnd")return false;
  bool covers=frame.Left<=monitor.Left&&frame.Top<=monitor.Top&&frame.Right>=monitor.Right&&frame.Bottom>=monitor.Bottom;
  // QUNS_BUSY (2) includes ordinary focus/notification suppression. It is NOT a
  // fullscreen signal. D3D/presentation can qualify only on this near-full window.
  return covers||NearMonitor&&!caption&&(shellState==3||shellState==4);
 }}
 public bool HideIsland(bool enabled,string targetMonitor){return enabled&&Fullscreen&&monitorName==targetMonitor;}
}
sealed class FullscreenCache {
 readonly Func<IntPtr> foreground;readonly Func<IntPtr,FullscreenObservation> capture;
 bool valid;FullscreenObservation cached;
 public FullscreenCache(Func<IntPtr> current,Func<IntPtr,FullscreenObservation> read){foreground=current;capture=read;}
 public void Invalidate(){valid=false;}
 public FullscreenObservation Read(){IntPtr window=foreground();if(!valid||cached.window!=window){cached=capture(window);valid=true;}return cached;}
}
