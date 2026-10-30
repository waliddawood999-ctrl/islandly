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
 [DllImport("Islandly.Motion.dll",CallingConvention=CallingConvention.Cdecl,CharSet=CharSet.Unicode)] public static extern void MotionAdapter(IntPtr renderer,System.Text.StringBuilder name,int capacity);
 [DllImport("Islandly.Motion.dll",CallingConvention=CallingConvention.Cdecl)] public static extern int MotionBlink(IntPtr renderer,int animateModel);
 [DllImport("Islandly.Motion.dll",CallingConvention=CallingConvention.Cdecl)] public static extern void MotionPose(IntPtr renderer,ref Snapshot snapshot);
 [DllImport("Islandly.Motion.dll",CallingConvention=CallingConvention.Cdecl)] public static extern void MotionApproach(IntPtr renderer,float value);
 [DllImport("Islandly.Motion.dll",CallingConvention=CallingConvention.Cdecl)] public static extern int MotionFade(IntPtr renderer);
 [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point point);
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentThread();
 [DllImport("kernel32.dll")] static extern bool GetThreadTimes(IntPtr thread,out long creation,out long exit,out long kernel,out long user);
 public static double CpuMs(){long a,b,k,u;return GetThreadTimes(GetCurrentThread(),out a,out b,out k,out u)?(k+u)/10000.0:0;}
 public static void Check(int hr){if(hr<0)Marshal.ThrowExceptionForHR(hr);}
}
sealed class MotionOptions {
 public Rectangle screen;public float scale=1,center,top;public Rectangle hotZone;public bool eyes,eco,fullscreen,compact,light,rtl,acrylic,floating,hidden,sliver,loading;public string mode="full",label="",date="";
}
sealed class NativeMotion:IDisposable {
 readonly Form owner;readonly string adapter;readonly Action hover,leave;readonly bool diagnostics;
 readonly Stopwatch clock=Stopwatch.StartNew();readonly Random random=new Random();
 readonly System.Windows.Forms.Timer eyesTimer=new System.Windows.Forms.Timer(),blinkTimer=new System.Windows.Forms.Timer(),fadeTimer=new System.Windows.Forms.Timer();
 readonly Halo halo;
 IntPtr renderer;MotionOptions options=new MotionOptions();MotionApi.Snapshot snapshot;
 MotionApi.Frame frame;
 int target,loop,pending;volatile bool disposed;bool tracking,hasPoint;long eyeUntil,lastMove,lastStep,inputAt;Point lastPoint;float dx,dy,anticipation;int pointer=-1;
 readonly List<object> samples=new List<object>();long cursorReads,renders,inputSequence;double firstResponse=-1,lastFrame,eyeDirtyX,eyeDirtyY,eyeDirtyLid,eyeDirtyBlink;bool fading,resizing;long resizeAt;float resizeFromW,resizeFromH,resizeToW,resizeToH;Action presentPanel;float paintedAnticipation,paintedBody=-1,paintedDrop=-1,paintedGx,paintedGy,paintedLid,paintedBlink;int paintedEyes=-1;string paintedLabel="";
 float cardWidth=360,cardHeight=440;
 readonly object workerGate=new object();Thread worker;
 public NativeMotion(Form form,Action onHover,Action onLeave,Action onClick,bool measure){owner=form;hover=onHover;leave=onLeave;diagnostics=measure;
  MotionApi.Check(MotionApi.MotionCreate(owner.Handle,out renderer));var adapterName=new System.Text.StringBuilder(256);MotionApi.MotionAdapter(renderer,adapterName,adapterName.Capacity);adapter=adapterName.ToString();
  halo=new Halo();halo.MouseEnter+=delegate{if(options.hidden&&!options.hotZone.IsEmpty){if(Reveal!=null)Reveal();return;}PointerEvent();hover();};halo.MouseMove+=delegate{PointerEvent();};halo.MouseLeave+=delegate{leave();};halo.MouseClick+=delegate(object s,MouseEventArgs e){if(e.Button==MouseButtons.Left){PointerEvent();onClick();}};
  eyesTimer.Interval=33;eyesTimer.Tick+=delegate{EyeTick();};blinkTimer.Tick+=delegate{blinkTimer.Stop();bool live=tracking&&eyesTimer.Enabled;MotionApi.Check(MotionApi.MotionBlink(renderer,live?1:0));if(live){eyeUntil=clock.ElapsedMilliseconds+600;lastMove=clock.ElapsedMilliseconds;StartEyes();}else ScheduleBlink();};
  fadeTimer.Interval=120;fadeTimer.Tick+=delegate{fadeTimer.Stop();fading=false;owner.Hide();halo.Hide();};
 }
 public event Action<double> FrameChanged;
 public Action Reveal;
 public void PlaceHaloNow(){PlaceHalo();}
 public bool Opening {get{return target!=0;}}
 public bool VisibleEyes {get{return snapshot.visible!=0;}}
 public object Report {get{return new{backend="Direct2D/DirectComposition",adapter=adapter,body=snapshot.body,drop=snapshot.drop,gx=snapshot.gx,gy=snapshot.gy,lid=snapshot.lid,blink=snapshot.blink,eyesVisible=snapshot.visible!=0&&owner.Visible,frameLoop=loop!=0,cursorTimer=eyesTimer.Enabled&&tracking,cursorReads=cursorReads,renders=renders,inputSequence=inputSequence,inputFirstMs=firstResponse,center=options.center,top=options.top,scale=options.scale,floating=options.floating,light=options.light,fullscreen=options.fullscreen,hidden=options.hidden,cardWidth=cardWidth,cardHeight=cardHeight};}}
 public void Configure(MotionOptions next){bool changed=options.eyes!=next.eyes||options.eco!=next.eco||options.mode!=next.mode||options.fullscreen!=next.fullscreen||options.compact!=next.compact||options.light!=next.light||options.rtl!=next.rtl||options.acrylic!=next.acrylic||options.floating!=next.floating||options.center!=next.center||options.top!=next.top||options.scale!=next.scale||options.label!=next.label||options.date!=next.date||options.hidden!=next.hidden||options.hotZone!=next.hotZone||options.sliver!=next.sliver||options.screen!=next.screen||options.loading!=next.loading;
  options=next;float s=options.scale;int w=Math.Min(options.screen.Width,(int)Math.Ceiling(600*s)),h=Math.Min(options.screen.Height,(int)Math.Ceiling(920*s));
  int left=Math.Max(options.screen.Left,Math.Min(options.screen.Right-w,(int)(options.center-w/2f)));
  var bounds=new Rectangle(left,options.screen.Top,w,h);if(owner.Bounds!=bounds)owner.Bounds=bounds;
  frame=new MotionApi.Frame{width=w,height=h,scale=s,center=(options.center-left)/s,top=(options.top-options.screen.Top)/s,left=(options.screen.Left-left)/s,right=(options.screen.Right-left)/s,cardWidth=cardWidth,cardHeight=cardHeight,opacity=fading?frame.opacity:1,anticipation=0,flags=(options.light?1:0)|(options.rtl?2:0)|(options.acrylic?4:0)|(options.floating?8:0)|(options.sliver?16:0)|(options.loading?64:0)};
  if(options.hidden){Input();Step(0);Interlocked.Exchange(ref loop,0);StopEyes();owner.Hide();
   // Hidden by fullscreen or 'show on approach': no timers run; one input-only strip (alpha 1/255, never activates) wakes the island when the mouse enters it.
   if(options.hotZone.IsEmpty)halo.Hide();else{if(halo.Bounds!=options.hotZone)halo.Bounds=options.hotZone;if(!halo.Visible)halo.Show();}
   firstResponse=clock.ElapsedMilliseconds-inputAt;return;}
  if(changed&&!fading){Input();Step(0);Draw(false);if(snapshot.visible!=0&&options.mode=="full"){eyeUntil=clock.ElapsedMilliseconds+1500;StartEyes();}else StopEyes();}
  if(!fading&&owner.Visible)PlaceHalo();
  if(snapshot.moving!=0||resizing)StartLoop();else if(options.mode=="off")Interlocked.Exchange(ref loop,0);
  if(snapshot.visible==0||options.mode!="full"){StopEyes();}else if(!blinkTimer.Enabled)ScheduleBlink();
 }
 void Input(){inputAt=clock.ElapsedMilliseconds;firstResponse=-1;inputSequence++;}
 public void Open(bool open){Input();resizing=false;presentPanel=null;if(open&&snapshot.body<.01f){cardWidth=Math.Min(360,(options.screen.Width-24*options.scale)/options.scale);cardHeight=Math.Min(440,(options.screen.Height-(options.top-options.screen.Top)-12*options.scale)/options.scale);frame.cardWidth=cardWidth;frame.cardHeight=cardHeight;}anticipation=0;MotionApi.MotionApproach(renderer,0);target=open?1:0;fading=false;fadeTimer.Stop();frame.opacity=1;StopEyes();owner.Show();owner.BringToFront();Step(0);Draw(false);if(snapshot.moving!=0)StartLoop();else PlaceHalo(); /* while the springs run, FrameTick places the halo once at rest: a Show() between the first two frames cost ~30 ms once per open/close */}
 public void Ready(float width,float height,Action present){
  if(float.IsNaN(width)||float.IsInfinity(width)||float.IsNaN(height)||float.IsInfinity(height)||width<=0||height<=0)throw new ArgumentException("Invalid measured panel size");
  resizeFromW=cardWidth;resizeFromH=cardHeight;resizeToW=Math.Max(138,Math.Min(560,width/options.scale));resizeToH=Math.Max(36,Math.Min(560,height/options.scale));resizeAt=clock.ElapsedMilliseconds;presentPanel=present;
  if(options.mode=="off"){cardWidth=resizeToW;cardHeight=resizeToH;frame.cardWidth=cardWidth;frame.cardHeight=cardHeight;Draw(false);Present();return;}
  resizing=true;StartLoop();
 }
 void UpdateMeasuredSize(){if(!resizing)return;float t=Math.Min(1,(clock.ElapsedMilliseconds-resizeAt)/120f),ease=1-(1-t)*(1-t)*(1-t);cardWidth=resizeFromW+(resizeToW-resizeFromW)*ease;cardHeight=resizeFromH+(resizeToH-resizeFromH)*ease;frame.cardWidth=cardWidth;frame.cardHeight=cardHeight;if(t>=1)resizing=false;}
 void Present(){var show=presentPanel;presentPanel=null;if(show==null)return;halo.Hide();show();
  if(options.eco||options.mode!="full"){owner.Hide();return;}fading=true;Interlocked.Exchange(ref loop,0);MotionApi.Check(MotionApi.MotionFade(renderer));fadeTimer.Start();
 }

 public void LeaveApproach(){if(anticipation==0)return;anticipation=0;MotionApi.MotionApproach(renderer,0);Step(0);if(snapshot.moving!=0)StartLoop();}
 public bool ContainsPointer(){Point p;cursorReads++;if(!MotionApi.GetCursorPos(out p))return false;float s=options.scale,w=(138+(cardWidth-138)*snapshot.body)*s,h=(36+(cardHeight-36)*snapshot.body)*s;
  float x=Math.Max(options.screen.Left+12*s,Math.Min(options.screen.Right-12*s-w,options.center-w/2));return p.X>=x-16*s&&p.X<=x+w+16*s&&p.Y>=options.top-16*s&&p.Y<=options.top+h+16*s;
 }
 public void Hide(){StopEyes();halo.Hide();owner.Hide();}
 void PlaceHalo(){if(disposed||options.hidden||!owner.Visible)return;float s=options.scale;float f=snapshot.body;float w=(138+(cardWidth-138)*f)*s,h=(36+(cardHeight-36)*f)*s;
  int x=(int)Math.Max(options.screen.Left+12*s,Math.Min(options.screen.Right-12*s-w,options.center-w/2));
  var rect=new Rectangle(x-(int)(20*s),(int)(options.top-20*s),(int)(w+40*s),(int)(h+40*s));
  // A separate input-only HWND avoids acrylic blurring the invisible halo.
  if(halo.Bounds!=rect)halo.Bounds=rect;if(!halo.Visible){halo.Show();owner.BringToFront();}
 }
 public void PointerEvent(){if(disposed||options.hidden)return;Point p;cursorReads++;if(!MotionApi.GetCursorPos(out p))return;if(hasPoint&&p==lastPoint)return;hasPoint=true;Step((clock.ElapsedMilliseconds-lastStep)/1000f);float s=options.scale;dx=(p.X-options.center)/s;dy=(p.Y-(options.top+18*s))/s;float distance=(float)Math.Sqrt(dx*dx+dy*dy);
  pointer=(Math.Abs(dx)<=69&&Math.Abs(dy)<=18)?2:1;tracking=distance<240;
  if(lastPoint!=p){lastPoint=p;lastMove=clock.ElapsedMilliseconds;eyeUntil=lastMove+1500;}
  float oldAnticipation=anticipation;float edgeX=Math.Max(0,Math.Abs(dx)-69),edgeY=Math.Max(0,Math.Abs(dy)-18),edgeDistance=(float)Math.Sqrt(edgeX*edgeX+edgeY*edgeY);anticipation=options.mode=="full"&&!options.eco&&target==0?.1f*Math.Max(0,1-edgeDistance/48):0;frame.anticipation=0;MotionApi.MotionApproach(renderer,anticipation);
  Step(0);if(snapshot.visible!=0||Math.Abs(oldAnticipation-anticipation)>.00001f)Input();if(snapshot.visible!=0&&options.mode=="full")StartEyes();if(snapshot.moving!=0)StartLoop();
 }
 void StartEyes(){if(snapshot.visible==0||options.mode!="full"||options.eco)return;if(eyesTimer.Interval!=62)eyesTimer.Interval=62;if(!eyesTimer.Enabled)eyesTimer.Start();}
 void StopEyes(){eyesTimer.Stop();blinkTimer.Stop();tracking=false;pointer=-1;}
 void ScheduleBlink(){if(snapshot.visible==0||options.mode!="full")return;blinkTimer.Interval=tracking?random.Next(3000,4001):random.Next(8000,14001);blinkTimer.Start();}
 void EyeTick(){if(disposed||snapshot.visible==0||options.eco||options.mode!="full"){StopEyes();return;}
  if(tracking){Point p;cursorReads++;if(MotionApi.GetCursorPos(out p)){float s=options.scale;dx=(p.X-options.center)/s;dy=(p.Y-(options.top+18*s))/s;float distance=(float)Math.Sqrt(dx*dx+dy*dy);pointer=Math.Abs(dx)<=69&&Math.Abs(dy)<=18?2:1;
    if(p!=lastPoint){lastPoint=p;lastMove=clock.ElapsedMilliseconds;eyeUntil=lastMove+1500;Input();}if(distance>=240){tracking=false;eyeUntil=clock.ElapsedMilliseconds+1500;}}}
  Step((clock.ElapsedMilliseconds-lastStep)/1000f);
  if(snapshot.blink>=.999f&&eyeDirtyBlink<.999&&!blinkTimer.Enabled)ScheduleBlink();
  // Redraw only when something moved: gaze by >= .75 px, lid >= .5 px, blink >= .25 px (gaze travels 4 x 3 px): gaze travels 4 x 3 px, the lid slot is 30 px, the blink changes a 13 px width.
  bool dirty=Math.Abs(snapshot.gx-eyeDirtyX)*4>=.75||Math.Abs(snapshot.gy-eyeDirtyY)*3>=.75||Math.Abs(snapshot.lid-eyeDirtyLid)*30>=.5||Math.Abs(snapshot.blink-eyeDirtyBlink)*13>=.25;
  if(dirty){Draw(true);eyeDirtyX=snapshot.gx;eyeDirtyY=snapshot.gy;eyeDirtyLid=snapshot.lid;eyeDirtyBlink=snapshot.blink;}
  // Assigning Interval on a running WinForms Timer kills and re-creates it: only touch it when the rate really changes. 45 ms (~21 Hz after the 15.6 ms timer quantum) while the cursor moves, 100 ms when still.
  int wantInterval=clock.ElapsedMilliseconds-lastMove<1500?62:100;if(eyesTimer.Interval!=wantInterval)eyesTimer.Interval=wantInterval;
  if(!tracking&&clock.ElapsedMilliseconds>eyeUntil){eyesTimer.Stop();ScheduleBlink();}
 }
 void Step(float dt){int flags=(options.eyes?1:0)|(options.eco?2:0)|(options.mode=="reduced"?4:0)|(options.mode=="off"?8:0)|(options.fullscreen?16:0)|(options.compact?32:0);
  MotionApi.MotionStep(renderer,dt,flags,dx,dy,pointer,target,out snapshot);pointer=-1;lastStep=clock.ElapsedMilliseconds;
 }
 [DllImport("winmm.dll")] static extern uint timeBeginPeriod(uint ms);[DllImport("winmm.dll")] static extern uint timeEndPeriod(uint ms); // 1 ms timer resolution only while a liquid burst runs: the default 15.6 ms quantum turned 16 ms waits into 31 ms
 void StartLoop(){lock(workerGate){Interlocked.Exchange(ref loop,1);if(worker!=null)return;
  bool precise=!options.eco;worker=new Thread(delegate(){if(precise)timeBeginPeriod(1);try{while(!disposed&&Volatile.Read(ref loop)!=0){MotionApi.MotionWait();if(disposed)break;
    if(Interlocked.CompareExchange(ref pending,1,0)==0)try{owner.BeginInvoke((Action)delegate{Interlocked.Exchange(ref pending,0);if(disposed)return;FrameTick();});}catch(InvalidOperationException){break;}
  }}finally{if(precise)timeEndPeriod(1);lock(workerGate){worker=null;}if(!disposed&&Volatile.Read(ref loop)!=0)try{owner.BeginInvoke((Action)StartLoop);}catch(InvalidOperationException){}}}){IsBackground=true,Name="Islandly motion burst"};worker.Start();}
 }
 void FrameTick(){if(options.hidden){Interlocked.Exchange(ref loop,0);return;}Step((clock.ElapsedMilliseconds-lastStep)/1000f);UpdateMeasuredSize();Draw(false);if(!resizing&&presentPanel!=null)Present();if(snapshot.moving==0&&!resizing){Interlocked.Exchange(ref loop,0);PlaceHalo();if(snapshot.visible!=0){eyeUntil=clock.ElapsedMilliseconds+1500;StartEyes();ScheduleBlink();}}}
 void Draw(bool dirty){if(disposed||options.hidden)return;double start=clock.Elapsed.TotalMilliseconds,cpu=diagnostics?MotionApi.CpuMs():0;if(dirty)frame.flags|=32;
  try{MotionApi.Check(MotionApi.MotionDraw(renderer,ref frame,options.label,options.date,null));}finally{frame.flags&=~32;}renders++;
  double end=clock.Elapsed.TotalMilliseconds;bool changed=Math.Abs(frame.anticipation-paintedAnticipation)>.00001||Math.Abs(snapshot.body-paintedBody)>.00001||Math.Abs(snapshot.drop-paintedDrop)>.00001||Math.Abs(snapshot.gx-paintedGx)>.0001||Math.Abs(snapshot.gy-paintedGy)>.0001||Math.Abs(snapshot.lid-paintedLid)>.0001||Math.Abs(snapshot.blink-paintedBlink)>.0001||snapshot.visible!=paintedEyes||options.label!=paintedLabel;
  if(firstResponse<0&&changed)firstResponse=end-inputAt;paintedAnticipation=frame.anticipation;paintedBody=snapshot.body;paintedDrop=snapshot.drop;paintedGx=snapshot.gx;paintedGy=snapshot.gy;paintedLid=snapshot.lid;paintedBlink=snapshot.blink;paintedEyes=snapshot.visible;paintedLabel=options.label;if(changed&&FrameChanged!=null)FrameChanged(end);
  if(diagnostics&&samples.Count<2048)samples.Add(new{at=end,interval=lastFrame==0?0:start-lastFrame,cpuMs=MotionApi.CpuMs()-cpu,wallMs=end-start,inputMs=firstResponse,body=snapshot.body,cardWidth=cardWidth,cardHeight=cardHeight,resizing=resizing});lastFrame=start;
 }
 public object[] FrameSamples {get{return samples.ToArray();}}
 public void Probe(string command){if(command=="motion-open"){samples.Clear();lastFrame=0;Open(true);}else if(command=="motion-close")Open(false);else if(command=="motion-pointer")PointerEvent();else if(command=="motion-measure")Ready(360*options.scale,300*options.scale,delegate{});}
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
 readonly EventProc callback;readonly Form owner;readonly string adapter;IntPtr foreground,location;int queued;bool disposed;
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
 // The location hook listens to the foreground window's thread only: a system-wide hook wakes the host for every cursor move and every window move on the desktop.
 void HookLocation(IntPtr window){if(location!=IntPtr.Zero){UnhookWinEvent(location);location=IntPtr.Zero;}if(window==IntPtr.Zero)return;uint process;uint thread=GetWindowThreadProcessId(window,out process);if(thread==0)return;location=SetWinEventHook(0x800b,0x800b,IntPtr.Zero,callback,process,thread,2);}
 public ForegroundWatcher(Form form,Action changed){owner=form;callback=delegate(IntPtr h,uint ev,IntPtr window,int obj,int child,uint thread,uint time){if(disposed||window==IntPtr.Zero||ev==0x800b&&(obj!=0||window!=GetForegroundWindow()))return;
  if(ev==3)HookLocation(window);
  if(Interlocked.CompareExchange(ref queued,1,0)==0)try{owner.BeginInvoke((Action)delegate{Interlocked.Exchange(ref queued,0);if(!disposed)changed();});}catch(InvalidOperationException){}};
  foreground=SetWinEventHook(3,3,IntPtr.Zero,callback,0,0,2);HookLocation(GetForegroundWindow());
 }
 public void Dispose(){disposed=true;if(foreground!=IntPtr.Zero)UnhookWinEvent(foreground);if(location!=IntPtr.Zero)UnhookWinEvent(location);}
}
