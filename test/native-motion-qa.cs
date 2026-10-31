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
  try{foreach(float dpi in new[]{1f,1.25f,1.5f,2f})foreach(string lang in new[]{"ar","en"})foreach(bool light in new[]{false,true})foreach(bool appbar in new[]{false,true})foreach(bool acrylic in new[]{false,true})foreach(bool floating in new[]{false,true}){
   string name=lang+"-"+(light?"light":"dark")+"-"+(appbar?"appbar":"overlay")+"-"+(acrylic?"acrylic":"glass")+"-"+(floating?"floating":"flush")+"-"+dpi;
   string dir=Path.Combine(output,name);Directory.CreateDirectory(dir);
   var frame=new MotionApi.Frame{width=600*dpi,height=700*dpi,scale=dpi,center=300,top=floating?14:8,left=0,right=600,cardWidth=360,cardHeight=440,opacity=1,flags=(light?1:0)|(lang=="ar"?2:0)|(acrylic?4:0)|(floating?8:0)};
   foreach(string pose in new[]{"rest","left","right","below-left","below-right","below","far-left","far-right","sleepy","blink","squint","reduced","eco-hidden","fullscreen-hidden","off-hidden"}){
    float gx=pose.Contains("left")?-1:pose.Contains("right")?1:0,gy=pose.Contains("below")?1:0;if(gx!=0&&gy!=0){gx*=.81697f;gy*=.57868f;}if(pose.StartsWith("far")){gx*=.6f;}
    bool hidden=pose.Contains("hidden");var snap=new MotionApi.Snapshot{gx=gx,gy=gy,lid=pose=="sleepy"||pose.StartsWith("far")?.54f:0,blink=pose=="blink"?.1f:1,squint=pose=="squint"?1:0,visible=hidden?0:1};
    MotionApi.MotionPose(engine,ref snap);string file=Path.Combine(dir,pose+".png");MotionApi.Check(MotionApi.MotionDraw(engine,ref frame,"10:42",lang=="ar"?"الخميس، ٢٩ أكتوبر":"Thursday, 29 October",file));count++;
    // Conservative transformed capsule bounds including the physical gaze shift.
    double rightEyeEdge=42+4*gx+(13*Math.Cos(11*Math.PI/180)+26*Math.Sin(11*Math.PI/180))/2;
    double gap=lang=="en"?68-rightEyeEdge:(96+4*gx-(13*Math.Cos(11*Math.PI/180)+26*Math.Sin(11*Math.PI/180))/2)-70;
    Require(gap>=11,"Eye/time overlap at "+name+"/"+pose);Require(Math.Abs(gx*4)<=4.001&&Math.Abs(gy*3)<=3.001,"Gaze left its fixed slot");
    using(var image=new Bitmap(file)){Require(image.Width==(int)frame.width&&image.Height==(int)frame.height,"DPI capture dimensions changed");Require(image.GetPixel(0,0).A==0,"Square backdrop outside the clipped shape");if(!hidden){
     float pillLeft=frame.center-84;float[] slots=lang=="ar"?new[]{126f,148f}:new[]{20f,42f};
     foreach(float slot in slots){int minX=image.Width,minY=image.Height,maxX=-1,maxY=-1,countPixels=0;float cx=pillLeft+slot+4*gx,cy=frame.top+18+3*gy-.5f*snap.squint;
      for(int py=Math.Max(0,(int)((frame.top+1)*dpi));py<Math.Min(image.Height,(int)((frame.top+35)*dpi));py++)for(int px=Math.Max(0,(int)((pillLeft+slot-10+4*gx)*dpi));px<Math.Min(image.Width,(int)((pillLeft+slot+10+4*gx)*dpi));px++){
       Color pixel=image.GetPixel(px,py);bool ink=pixel.A>180&&(light?pixel.R<70&&pixel.G<70&&pixel.B<80:pixel.R>200&&pixel.G>200&&pixel.B>200);
       if(ink){minX=Math.Min(minX,px);maxX=Math.Max(maxX,px);minY=Math.Min(minY,py);maxY=Math.Max(maxY,py);countPixels++;}
      }
      Require(countPixels>3*dpi,"Filled eye missing: "+name+"/"+pose);
      Require(minY>=(frame.top+.5f)*dpi-1&&maxY<=(frame.top+35.5f)*dpi+1,"Eye clipped outside pill");
      if(snap.lid==0){double actualCenter=(minX+maxX+1)/(2*dpi);Require(Math.Abs(actualCenter-cx)<=1.5,"Eye drift: "+name+"/"+pose+" actual="+actualCenter+" expected="+cx);}
      if(pose=="rest"){Color pixel=image.GetPixel((int)(cx*dpi),(int)(cy*dpi));Require(light?pixel.R==12&&pixel.G==12&&pixel.B==18:pixel.R==247&&pixel.G==248&&pixel.B==252,"Eye solid fill colour differs from handoff");}
     }
    }}
   }
   foreach(int time in new[]{0,30,60,100,150,260}){var snap=new MotionApi.Snapshot{visible=1,blink=1};MotionApi.MotionPose(engine,ref snap);for(int ms=0;ms<time;ms++)MotionApi.MotionStep(engine,.001f,1,0,0,-1,1,out snap);
    string file=Path.Combine(dir,"open-"+time+"ms.png");MotionApi.Check(MotionApi.MotionDraw(engine,ref frame,"10:42",lang=="ar"?"الخميس، ٢٩ أكتوبر":"Thursday, 29 October",file));count++;
    Require(138+(frame.cardWidth-138)*snap.body>=137,"Liquid body clipped");report.Add(new{scene=name,timeMs=time,body=snap.body,drop=snap.drop,width=138+(frame.cardWidth-138)*snap.body,height=36+(frame.cardHeight-36)*snap.body,bulge=Math.Max(0,snap.drop-snap.body)*164,appBarStrip=appbar?(floating?58:44)*dpi:0});
   }
   foreach(string transition in new[]{"close","reverse"})foreach(int time in new[]{0,30,60,100,150,260}){
    var snap=new MotionApi.Snapshot{body=transition=="close"?1:0,drop=transition=="close"?1:0,visible=1,blink=1};MotionApi.MotionPose(engine,ref snap);
    if(transition=="reverse")for(int ms=0;ms<100;ms++)MotionApi.MotionStep(engine,.001f,1,0,0,-1,1,out snap);
    for(int ms=0;ms<time;ms++)MotionApi.MotionStep(engine,.001f,1,0,0,-1,0,out snap);
    MotionApi.Check(MotionApi.MotionDraw(engine,ref frame,"10:42",lang=="ar"?"الخميس، ٢٩ أكتوبر":"Thursday, 29 October",Path.Combine(dir,transition+"-"+time+"ms.png")));count++;
   }
   foreach(string position in new[]{"left","center","right"}){
    frame.center=position=="left"?(floating?20:16)+69:position=="right"?600-(floating?20:16)-69:300;
    var snap=new MotionApi.Snapshot();MotionApi.MotionPose(engine,ref snap);for(int ms=0;ms<100;ms++)MotionApi.MotionStep(engine,.001f,1,0,0,-1,1,out snap);
    MotionApi.Check(MotionApi.MotionDraw(engine,ref frame,"10:42",lang=="ar"?"الخميس، ٢٩ أكتوبر":"Thursday, 29 October",Path.Combine(dir,"position-"+position+".png")));count++;
   }

  }
  File.WriteAllText(Path.Combine(output,"geometry.json"),new JavaScriptSerializer{MaxJsonLength=16000000}.Serialize(new{screenshots=count,matrix="ar/en x light/dark x overlay/AppBar x acrylic/glass x floating/flush x 100/150/200 DPI",primary="Direct2D production surface readback",secondary="offset clamp covered by production Model.test.cpp; real second monitor NOT RUN",cases=report}));
  using(var board=new Bitmap(800,240))using(var drawing=Graphics.FromImage(board))using(var font=new Font("Segoe UI",10)){
   drawing.Clear(Color.FromArgb(235,235,240));int index=0;
   foreach(string lang in new[]{"ar","en"})foreach(bool light in new[]{false,true})foreach(string pose in new[]{"rest","below-left"}){
    string scene=lang+"-"+(light?"light":"dark")+"-overlay-glass-floating-1";string file=Path.Combine(output,scene,pose+".png");int bx=(index%4)*200,by=(index/4)*120;
    using(var tile=new Bitmap(file)){drawing.DrawString(lang+" / "+(light?"light":"dark")+" / "+pose,font,Brushes.Black,bx+5,by+5);drawing.DrawImage(tile,new Rectangle(bx+10,by+40,180,60),new Rectangle(210,4,180,60),GraphicsUnit.Pixel);}index++;
   }
   string preview=Path.Combine(output,"preview.png");board.Save(preview,System.Drawing.Imaging.ImageFormat.Png);Console.WriteLine("T21_PREVIEW_BASE64 "+Convert.ToBase64String(File.ReadAllBytes(preview)));
  }
  Console.WriteLine("NATIVE SCREENSHOTS PASS: "+count+" production Direct2D captures; eye/time gap >=11px, fixed gaze, transparent outside path, DPI sizes");
  }finally{MotionApi.MotionDestroy(engine);}
 }}
}
