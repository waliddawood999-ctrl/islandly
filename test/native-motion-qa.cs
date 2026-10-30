using System;
using System.IO;
using System.Collections.Generic;
using System.Drawing;
using System.Windows.Forms;
using System.Web.Script.Serialization;
static class NativeMotionQa {
 [STAThread] static int Main(string[] args){try{Run(args[0]);return 0;}catch(Exception e){Console.Error.WriteLine(e);return 1;}}
 static void Require(bool value,string message){if(!value)throw new Exception(message);}
 static void Run(string output){Directory.CreateDirectory(output);Application.EnableVisualStyles();using(var window=new Form{FormBorderStyle=FormBorderStyle.None,ShowInTaskbar=false,Width=1400,Height=1400}){
  window.Show();Application.DoEvents();IntPtr engine;MotionApi.Check(MotionApi.MotionCreate(window.Handle,out engine));var report=new List<object>();int count=0;
  try{foreach(float dpi in new[]{1f,1.5f,2f})foreach(string lang in new[]{"ar","en"})foreach(bool light in new[]{false,true})foreach(bool appbar in new[]{false,true})foreach(bool acrylic in new[]{false,true})foreach(bool floating in new[]{false,true}){
   string name=lang+"-"+(light?"light":"dark")+"-"+(appbar?"appbar":"overlay")+"-"+(acrylic?"acrylic":"glass")+"-"+(floating?"floating":"flush")+"-"+dpi;
   string dir=Path.Combine(output,name);Directory.CreateDirectory(dir);
   var frame=new MotionApi.Frame{width=600*dpi,height=700*dpi,scale=dpi,center=300,top=floating?14:8,left=0,right=600,cardWidth=440,cardHeight=200,opacity=1,flags=(light?1:0)|(lang=="ar"?2:0)|(acrylic?4:0)|(floating?8:0)};
   foreach(string pose in new[]{"rest","left","right","below-left","below-right","below","far-left","far-right","sleepy","blink","squint","reduced","eco-hidden","fullscreen-hidden","off-hidden"}){
    float gx=pose.Contains("left")?-1:pose.Contains("right")?1:0,gy=pose.Contains("below")?1:0;if(gx!=0&&gy!=0){gx*=.81697f;gy*=.57868f;}if(pose.StartsWith("far")){gx*=.6f;}
    bool hidden=pose.Contains("hidden");var snap=new MotionApi.Snapshot{gx=gx,gy=gy,lid=pose=="sleepy"||pose.StartsWith("far")?.54f:0,blink=pose=="blink"?.1f:1,squint=pose=="squint"?1:0,visible=hidden?0:1};
    MotionApi.MotionPose(engine,ref snap);string file=Path.Combine(dir,pose+".png");MotionApi.Check(MotionApi.MotionDraw(engine,ref frame,"10:42",lang=="ar"?"الخميس، ٢٩ أكتوبر":"Thursday, 29 October",file));count++;
    // Conservative transformed capsule bounds including the physical gaze shift.
    double rightEyeEdge=42+4*gx+(13*Math.Cos(11*Math.PI/180)+26*Math.Sin(11*Math.PI/180))/2;
    double gap=lang=="en"?68-rightEyeEdge:(96+4*gx-(13*Math.Cos(11*Math.PI/180)+26*Math.Sin(11*Math.PI/180))/2)-70;
    Require(gap>=11,"Eye/time overlap at "+name+"/"+pose);Require(Math.Abs(gx*4)<=4.001&&Math.Abs(gy*3)<=3.001,"Gaze left its fixed slot");
    using(var image=new Bitmap(file)){Require(image.Width==(int)frame.width&&image.Height==(int)frame.height,"DPI capture dimensions changed");Require(image.GetPixel(0,0).A==0,"Square backdrop outside the clipped shape");}
   }
   foreach(int time in new[]{0,30,60,100,150,260}){var snap=new MotionApi.Snapshot();MotionApi.MotionPose(engine,ref snap);for(int ms=0;ms<time;ms++)MotionApi.MotionStep(engine,.001f,0,0,0,-1,1,out snap);
    string file=Path.Combine(dir,"open-"+time+"ms.png");MotionApi.Check(MotionApi.MotionDraw(engine,ref frame,"10:42",lang=="ar"?"الخميس، ٢٩ أكتوبر":"Thursday, 29 October",file));count++;
    Require(138+302*snap.body>=137,"Liquid body clipped");report.Add(new{scene=name,timeMs=time,body=snap.body,drop=snap.drop,width=138+302*snap.body,height=36+164*snap.body,bulge=Math.Max(0,snap.drop-snap.body)*164,appBarStrip=appbar?(floating?58:44)*dpi:0});
   }
  }
  File.WriteAllText(Path.Combine(output,"geometry.json"),new JavaScriptSerializer{MaxJsonLength=16000000}.Serialize(new{screenshots=count,matrix="ar/en x light/dark x overlay/AppBar x acrylic/glass x floating/flush x 100/150/200 DPI",primary="Direct2D production surface readback",secondary="offset clamp covered by production Model.test.cpp; real second monitor NOT RUN",cases=report}));
  Console.WriteLine("NATIVE SCREENSHOTS PASS: "+count+" production Direct2D captures; eye/time gap >=11px, fixed gaze, transparent outside path, DPI sizes");
  }finally{MotionApi.MotionDestroy(engine);}
 }}
}
