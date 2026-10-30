using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

static class MotionApi {
 [StructLayout(LayoutKind.Sequential)] public struct Snapshot { public float body,drop,gx,gy,lid,squint,blink;public int visible,moving; }
 [StructLayout(LayoutKind.Sequential)] public struct Frame {public float width,height,scale,center,top,left,right,cardWidth,cardHeight,anticipation,opacity;public int flags;}
 [DllImport("Islandly.Motion.dll",CallingConvention=CallingConvention.Cdecl)] public static extern int MotionCreate(IntPtr window,out IntPtr renderer);
 [DllImport("Islandly.Motion.dll",CallingConvention=CallingConvention.Cdecl)] public static extern void MotionDestroy(IntPtr renderer);
 [DllImport("Islandly.Motion.dll",CallingConvention=CallingConvention.Cdecl)] public static extern void MotionStep(IntPtr renderer,float dt,int flags,float dx,float dy,int pointer,int target,out Snapshot snapshot);
 [DllImport("Islandly.Motion.dll",CallingConvention=CallingConvention.Cdecl,CharSet=CharSet.Unicode)] public static extern int MotionDraw(IntPtr renderer,ref Frame frame,string time,string date,string capture);
 [DllImport("Islandly.Motion.dll",CallingConvention=CallingConvention.Cdecl)] public static extern int MotionWait();
 [DllImport("Islandly.Motion.dll",CallingConvention=CallingConvention.Cdecl)] public static extern void MotionBlink(IntPtr renderer);
 [DllImport("Islandly.Motion.dll",CallingConvention=CallingConvention.Cdecl)] public static extern void MotionPose(IntPtr renderer,ref Snapshot snapshot);
 [DllImport("Islandly.Motion.dll",CallingConvention=CallingConvention.Cdecl)] public static extern int MotionFade(IntPtr renderer);
 [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point point);
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentThread();
 [DllImport("kernel32.dll")] static extern bool GetThreadTimes(IntPtr thread,out long creation,out long exit,out long kernel,out long user);
 public static double CpuMs(){long a,b,k,u;return GetThreadTimes(GetCurrentThread(),out a,out b,out k,out u)?(k+u)/10000.0:0;}
 public static void Check(int hr){if(hr<0)Marshal.ThrowExceptionForHR(hr);}
}
sealed class MotionOptions {
 public Rectangle screen;public float scale=1,center,top;public bool eyes,eco,fullscreen,compact,light,rtl,acrylic,floating,hidden,sliver,loading;public string mode="full",label="",date="";
}
sealed class NativeMotion:IDisposable {
 readonly Form owner;readonly Action hover,leave;readonly bool diagnostics;
 readonly Stopwatch clock=Stopwatch.StartNew();readonly Random random=new Random();
 readonly System.Windows.Forms.Timer eyesTimer=new System.Windows.Forms.Timer(),blinkTimer=new System.Windows.Forms.Timer(),fadeTimer=new System.Windows.Forms.Timer();
 readonly Halo halo;
 IntPtr renderer;MotionOptions options=new MotionOptions();MotionApi.Snapshot snapshot;
 MotionApi.Frame frame;
 int target,loop,pending;volatile bool disposed;bool tracking;long eyeUntil,lastMove,lastStep,inputAt;Point lastPoint;float dx,dy,anticipation;int pointer=-1;
 readonly List<object> samples=new List<object>();long cursorReads,renders,inputSequence;double firstResponse=-1,lastFrame,eyeDirtyX,eyeDirtyY,eyeDirtyLid,eyeDirtyBlink;bool fading;float paintedBody=-1,paintedDrop=-1,paintedGx,paintedGy,paintedLid,paintedBlink;int paintedEyes=-1;string paintedLabel="";
 float cardWidth=360,cardHeight=440;
 readonly object workerGate=new object();Thread worker;
 public NativeMotion(Form form,Action onHover,Action onLeave,bool measure){owner=form;hover=onHover;leave=onLeave;diagnostics=measure;
  MotionApi.Check(MotionApi.MotionCreate(owner.Handle,out renderer));
  halo=new Halo();halo.MouseEnter+=delegate{PointerEvent();hover();};halo.MouseMove+=delegate{PointerEvent();};halo.MouseLeave+=delegate{leave();};halo.MouseClick+=delegate(object s,MouseEventArgs e){if(e.Button==MouseButtons.Left){PointerEvent();hover();}};
  eyesTimer.Interval=33;eyesTimer.Tick+=delegate{EyeTick();};blinkTimer.Tick+=delegate{blinkTimer.Stop();MotionApi.MotionBlink(renderer);eyeUntil=clock.ElapsedMilliseconds+600;lastMove=clock.ElapsedMilliseconds;StartEyes();};
  fadeTimer.Interval=120;fadeTimer.Tick+=delegate{fadeTimer.Stop();fading=false;owner.Hide();halo.Hide();};
 }
 public bool Opening {get{return target!=0;}}
 public bool VisibleEyes {get{return snapshot.visible!=0;}}
 public object Report {get{return new{backend="Direct2D/DirectComposition",body=snapshot.body,drop=snapshot.drop,gx=snapshot.gx,gy=snapshot.gy,lid=snapshot.lid,blink=snapshot.blink,eyesVisible=snapshot.visible!=0,frameLoop=loop!=0,cursorTimer=eyesTimer.Enabled&&tracking,cursorReads=cursorReads,renders=renders,inputSequence=inputSequence,inputFirstMs=firstResponse,center=options.center,top=options.top,scale=options.scale,floating=options.floating,cardWidth=cardWidth,cardHeight=cardHeight};}}
 public void Configure(MotionOptions next){bool changed=options.eyes!=next.eyes||options.eco!=next.eco||options.mode!=next.mode||options.fullscreen!=next.fullscreen||options.compact!=next.compact||options.light!=next.light||options.rtl!=next.rtl||options.acrylic!=next.acrylic||options.floating!=next.floating||options.center!=next.center||options.top!=next.top||options.scale!=next.scale||options.label!=next.label||options.date!=next.date||options.hidden!=next.hidden||options.sliver!=next.sliver||options.screen!=next.screen||options.loading!=next.loading;
  options=next;float s=options.scale;int w=Math.Min(options.screen.Width,(int)Math.Ceiling(600*s)),h=Math.Min(options.screen.Height,(int)Math.Ceiling(920*s));
  int left=Math.Max(options.screen.Left,Math.Min(options.screen.Right-w,(int)(options.center-w/2f)));
  var bounds=new Rectangle(left,options.screen.Top,w,h);if(owner.Bounds!=bounds)owner.Bounds=bounds;
  frame=new MotionApi.Frame{width=w,height=h,scale=s,center=(options.center-left)/s,top=(options.top-options.screen.Top)/s,left=(options.screen.Left-left)/s,right=(options.screen.Right-left)/s,cardWidth=cardWidth,cardHeight=cardHeight,opacity=fading?frame.opacity:1,anticipation=anticipation,flags=(options.light?1:0)|(options.rtl?2:0)|(options.acrylic?4:0)|(options.floating?8:0)|(options.sliver?16:0)|(options.loading?64:0)};
  if(options.hidden){StopEyes();halo.Hide();owner.Hide();return;}
  if(changed&&!fading){Input();Step(0);Draw(false);if(snapshot.visible!=0&&options.mode=="full"){eyeUntil=clock.ElapsedMilliseconds+1500;StartEyes();}}
  if(!fading&&owner.Visible)PlaceHalo();
  if(snapshot.moving!=0)StartLoop();
  if(snapshot.visible==0||options.mode!="full"){StopEyes();}else if(!blinkTimer.Enabled)ScheduleBlink();
 }
 void Input(){inputAt=clock.ElapsedMilliseconds;firstResponse=-1;inputSequence++;}
 public void Open(bool open){Input();target=open?1:0;fading=false;fadeTimer.Stop();frame.opacity=1;StopEyes();owner.Show();owner.BringToFront();Step(0);Draw(false);PlaceHalo();if(snapshot.moving!=0)StartLoop();}
 public void Ready(float width,float height){cardWidth=Math.Max(138,width/options.scale);cardHeight=Math.Max(36,height/options.scale);frame.cardWidth=cardWidth;frame.cardHeight=cardHeight;Draw(false);
  // The web window is already painted underneath. Only the native placeholder fades.
  if(options.eco||options.mode!="full"){owner.Hide();halo.Hide();return;}fading=true;Interlocked.Exchange(ref loop,0);MotionApi.Check(MotionApi.MotionFade(renderer));fadeTimer.Start();
 }
 public void Hide(){StopEyes();halo.Hide();owner.Hide();}
 void PlaceHalo(){if(disposed||options.hidden||!owner.Visible)return;float s=options.scale;float f=snapshot.body;float w=(138+(cardWidth-138)*f)*s,h=(36+(cardHeight-36)*f)*s;
  int x=(int)Math.Max(options.screen.Left+12*s,Math.Min(options.screen.Right-12*s-w,options.center-w/2));
  var rect=new Rectangle(x-(int)(20*s),(int)(options.top-20*s),(int)(w+40*s),(int)(h+40*s));
  // A separate input-only HWND avoids acrylic blurring the invisible halo.
  if(halo.Bounds!=rect)halo.Bounds=rect;if(!halo.Visible)halo.Show();owner.BringToFront();
 }
 public void PointerEvent(){if(disposed||options.hidden)return;Point p;cursorReads++;if(!MotionApi.GetCursorPos(out p))return;float s=options.scale;dx=(p.X-options.center)/s;dy=(p.Y-(options.top+18*s))/s;float distance=(float)Math.Sqrt(dx*dx+dy*dy);
  pointer=(Math.Abs(dx)<=69&&Math.Abs(dy)<=18)?2:1;tracking=distance<240;
  if(lastPoint!=p){lastPoint=p;lastMove=clock.ElapsedMilliseconds;eyeUntil=lastMove+1500;}
  anticipation=options.mode=="full"&&!options.eco&&target==0?.1f*Math.Max(0,1-distance/48):0;frame.anticipation=anticipation;
  Input();Step(.001f);Draw(false);if(snapshot.visible!=0&&options.mode=="full")StartEyes();
 }
 void StartEyes(){if(snapshot.visible==0||options.mode!="full"||options.eco)return;eyesTimer.Interval=33;eyesTimer.Start();}
 void StopEyes(){eyesTimer.Stop();blinkTimer.Stop();tracking=false;pointer=-1;}
 void ScheduleBlink(){if(snapshot.visible==0||options.mode!="full")return;blinkTimer.Interval=tracking?random.Next(3000,4001):random.Next(8000,14001);blinkTimer.Start();}
 void EyeTick(){if(disposed||snapshot.visible==0||options.eco||options.mode!="full"){StopEyes();return;}
  if(tracking){Point p;cursorReads++;if(MotionApi.GetCursorPos(out p)){float s=options.scale;dx=(p.X-options.center)/s;dy=(p.Y-(options.top+18*s))/s;float distance=(float)Math.Sqrt(dx*dx+dy*dy);pointer=Math.Abs(dx)<=69&&Math.Abs(dy)<=18?2:1;
    if(p!=lastPoint){lastPoint=p;lastMove=clock.ElapsedMilliseconds;eyeUntil=lastMove+1500;Input();}if(distance>=240){tracking=false;eyeUntil=clock.ElapsedMilliseconds+1500;}}}
  Step((clock.ElapsedMilliseconds-lastStep)/1000f);
  if(snapshot.blink>=.999f&&eyeDirtyBlink<.999&&!blinkTimer.Enabled)ScheduleBlink();
  bool dirty=Math.Abs(snapshot.gx-eyeDirtyX)>=.02||Math.Abs(snapshot.gy-eyeDirtyY)>=.02||Math.Abs(snapshot.lid-eyeDirtyLid)>=.002||Math.Abs(snapshot.blink-eyeDirtyBlink)>=.002;
  if(dirty){Draw(true);eyeDirtyX=snapshot.gx;eyeDirtyY=snapshot.gy;eyeDirtyLid=snapshot.lid;eyeDirtyBlink=snapshot.blink;}
  eyesTimer.Interval=clock.ElapsedMilliseconds-lastMove<1500?33:100;
  if(!tracking&&clock.ElapsedMilliseconds>eyeUntil){eyesTimer.Stop();ScheduleBlink();}
 }
 void Step(float dt){int flags=(options.eyes?1:0)|(options.eco?2:0)|(options.mode=="reduced"?4:0)|(options.mode=="off"?8:0)|(options.fullscreen?16:0)|(options.compact?32:0);
  MotionApi.MotionStep(renderer,dt,flags,dx,dy,pointer,target,out snapshot);pointer=-1;lastStep=clock.ElapsedMilliseconds;
 }
 void StartLoop(){lock(workerGate){Interlocked.Exchange(ref loop,1);if(worker!=null)return;
  worker=new Thread(delegate(){try{while(!disposed&&Volatile.Read(ref loop)!=0){long started=clock.ElapsedMilliseconds;int hr=MotionApi.MotionWait();if(hr<0||clock.ElapsedMilliseconds-started<4)Thread.Sleep(8);if(disposed)break;
    if(Interlocked.CompareExchange(ref pending,1,0)==0)try{owner.BeginInvoke((Action)delegate{Interlocked.Exchange(ref pending,0);if(disposed)return;FrameTick();});}catch(InvalidOperationException){break;}
  }}finally{lock(workerGate){worker=null;}if(!disposed&&Volatile.Read(ref loop)!=0)try{owner.BeginInvoke((Action)StartLoop);}catch(InvalidOperationException){}}}){IsBackground=true,Name="Islandly motion burst"};worker.Start();}
 }
 void FrameTick(){if(options.hidden){Interlocked.Exchange(ref loop,0);return;}Step((clock.ElapsedMilliseconds-lastStep)/1000f);Draw(false);if(snapshot.moving==0){Interlocked.Exchange(ref loop,0);PlaceHalo();if(snapshot.visible!=0){eyeUntil=clock.ElapsedMilliseconds+1500;StartEyes();ScheduleBlink();}}}
 void Draw(bool dirty){if(disposed||options.hidden)return;double start=clock.Elapsed.TotalMilliseconds,cpu=MotionApi.CpuMs();if(dirty)frame.flags|=32;
  try{MotionApi.Check(MotionApi.MotionDraw(renderer,ref frame,options.label,options.date,null));}finally{frame.flags&=~32;}renders++;
  double end=clock.Elapsed.TotalMilliseconds;bool changed=Math.Abs(snapshot.body-paintedBody)>.00001||Math.Abs(snapshot.drop-paintedDrop)>.00001||Math.Abs(snapshot.gx-paintedGx)>.0001||Math.Abs(snapshot.gy-paintedGy)>.0001||Math.Abs(snapshot.lid-paintedLid)>.0001||Math.Abs(snapshot.blink-paintedBlink)>.0001||snapshot.visible!=paintedEyes||options.label!=paintedLabel;
  if(firstResponse<0&&changed)firstResponse=end-inputAt;paintedBody=snapshot.body;paintedDrop=snapshot.drop;paintedGx=snapshot.gx;paintedGy=snapshot.gy;paintedLid=snapshot.lid;paintedBlink=snapshot.blink;paintedEyes=snapshot.visible;paintedLabel=options.label;
  if(diagnostics&&samples.Count<2048)samples.Add(new{at=end,interval=lastFrame==0?0:start-lastFrame,cpuMs=MotionApi.CpuMs()-cpu,wallMs=end-start,inputMs=firstResponse,body=snapshot.body});lastFrame=start;
 }
 public object[] FrameSamples {get{return samples.ToArray();}}
 public void Probe(string command){if(command=="motion-open"){samples.Clear();lastFrame=0;Open(true);}else if(command=="motion-close")Open(false);else if(command=="motion-pointer")PointerEvent();}
 public void Dispose(){disposed=true;Interlocked.Exchange(ref loop,0);StopEyes();fadeTimer.Stop();eyesTimer.Dispose();blinkTimer.Dispose();fadeTimer.Dispose();halo.Dispose();if(renderer!=IntPtr.Zero){MotionApi.MotionDestroy(renderer);renderer=IntPtr.Zero;}}
 sealed class Halo:Form {
  public Halo(){FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;TopMost=true;BackColor=Color.Black;Opacity=1/255.0;AutoScaleMode=AutoScaleMode.None;}
  protected override bool ShowWithoutActivation {get{return true;}}
  protected override CreateParams CreateParams {get{var p=base.CreateParams;p.ExStyle|=0x08000080;return p;}}
 }
}
// Foreground/location WinEvents are not cursor hooks. No fullscreen polling timer.
sealed class ForegroundWatcher:IDisposable {
 delegate void EventProc(IntPtr hook,uint ev,IntPtr window,int obj,int child,uint thread,uint time);
 [DllImport("user32.dll")] static extern IntPtr SetWinEventHook(uint min,uint max,IntPtr module,EventProc proc,uint process,uint thread,uint flags);
 [DllImport("user32.dll")] static extern bool UnhookWinEvent(IntPtr hook);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 readonly EventProc callback;readonly Form owner;IntPtr foreground,location;int queued;bool disposed;
 public ForegroundWatcher(Form form,Action changed){owner=form;callback=delegate(IntPtr h,uint ev,IntPtr window,int obj,int child,uint thread,uint time){if(disposed||window==IntPtr.Zero||ev==0x800b&&(obj!=0||window!=GetForegroundWindow()))return;
  if(Interlocked.CompareExchange(ref queued,1,0)==0)try{owner.BeginInvoke((Action)delegate{Interlocked.Exchange(ref queued,0);if(!disposed)changed();});}catch(InvalidOperationException){}};
  foreground=SetWinEventHook(3,3,IntPtr.Zero,callback,0,0,2);location=SetWinEventHook(0x800b,0x800b,IntPtr.Zero,callback,0,0,2);
 }
 public void Dispose(){disposed=true;if(foreground!=IntPtr.Zero)UnhookWinEvent(foreground);if(location!=IntPtr.Zero)UnhookWinEvent(location);}
}
