using System;
using System.IO;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Collections.Generic;
using System.Web.Script.Serialization;
// Independent CPU mask of the specified rounded card + absolute164px droplet.
// Compare every non-transparent GPU pixel, including rounded corners, not just a bounding box.
static class IslandShapeQa {
 static void Check(bool ok,string why){if(!ok)throw new Exception(why);}
 static GraphicsPath Mask(MotionApi.Frame f,MotionApi.Snapshot s){
  float w=Math.Max(36,138+(f.cardWidth-138)*s.body),h=Math.Max(5,36+(f.cardHeight-36)*s.body);
  float r=Math.Min(18+4*Math.Max(0,Math.Min(1,s.body)),Math.Min(w,h)/2),x=Math.Max(f.left+12,Math.Min(f.center-w/2,f.right-12-w)),y=f.top;
  float bulge=Math.Max(0,s.drop-s.body)*164,l=Math.Max(0,Math.Min(.3f*w,w/2-r-4)),c=x+w/2,q=.5522847498f*r;
  var p=new GraphicsPath();p.StartFigure();p.AddLine(x+r,y,x+w-r,y);p.AddBezier(x+w-r,y,x+w-r+q,y,x+w,y+r-q,x+w,y+r);p.AddLine(x+w,y+r,x+w,y+h-r);
  p.AddBezier(x+w,y+h-r,x+w,y+h-r+q,x+w-r+q,y+h,x+w-r,y+h);
  if(bulge>.5f&&l>0){p.AddLine(x+w-r,y+h,c+l,y+h);p.AddBezier(c+l,y+h,c+.5f*l,y+h,c+.55f*l,y+h+bulge,c,y+h+bulge);p.AddBezier(c,y+h+bulge,c-.55f*l,y+h+bulge,c-.5f*l,y+h,c-l,y+h);p.AddLine(c-l,y+h,x+r,y+h);}else p.AddLine(x+w-r,y+h,x+r,y+h);
  p.AddBezier(x+r,y+h,x+r-q,y+h,x,y+h-r+q,x,y+h-r);p.AddLine(x,y+h-r,x,y+r);p.AddBezier(x,y+r,x,y+r-q,x+r-q,y,x+r,y);p.CloseFigure();
  using(var m=new Matrix()){m.Scale(f.scale,f.scale);p.Transform(m);}return p;
 }
 static byte[] Bytes(Bitmap b){var d=b.LockBits(new Rectangle(0,0,b.Width,b.Height),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);try{Check(d.Stride==b.Width*4,"Unexpected bitmap stride");byte[] a=new byte[d.Stride*b.Height];Marshal.Copy(d.Scan0,a,0,a.Length);return a;}finally{b.UnlockBits(d);}}
 static void Audit(Bitmap image,MotionApi.Frame f,MotionApi.Snapshot s,bool light,string name){
  using(var mask=new Bitmap(image.Width,image.Height,PixelFormat.Format32bppArgb))using(var path=Mask(f,s))using(var g=Graphics.FromImage(mask))using(var edge=new Pen(Color.White,2)){
   g.Clear(Color.Transparent);g.SmoothingMode=SmoothingMode.None;g.FillPath(Brushes.White,path);g.DrawPath(edge,path); // one physical pixel covers raster edge antialiasing; exterior must be exact alpha0
   var a=Bytes(image);var m=Bytes(mask);int visible=0;
   for(int i=0;i<a.Length;i+=4)if(a[i+3]!=0){visible++;Check(m[i+3]!=0,"Opaque/tinted pixel outside rounded shape: "+name+" x="+((i/4)%image.Width)+" y="+((i/4)/image.Width));}
   Check(visible>100,"Empty surface: "+name);
   int cx=(int)(f.center*f.scale),cy=(int)((f.top+4)*f.scale);Color fill=image.GetPixel(cx,cy);
   Check(fill.A>100&&(light?fill.R>200&&fill.G>200&&fill.B>200:fill.R<40&&fill.G<40&&fill.B<40),"Wrong island theme: "+name+" "+fill);
  }
 }
 [STAThread] static int Main(string[]args){try{Directory.CreateDirectory(args[0]);Application.EnableVisualStyles();var rows=new List<object>();int count=0;
  using(var window=new Form{FormBorderStyle=FormBorderStyle.None,ShowInTaskbar=false,Width=600,Height=700}){window.Show();Application.DoEvents();IntPtr engine;MotionApi.Check(MotionApi.MotionCreate(window.Handle,out engine));try{
   foreach(string lang in new[]{"ar","en"})foreach(bool light in new[]{false,true})foreach(bool acrylic in new[]{false,true}){
    string scene=lang+"-"+(light?"light":"dark")+"-"+(acrylic?"acrylic":"glass");string dir=Path.Combine(args[0],scene);Directory.CreateDirectory(dir);
    var f=new MotionApi.Frame{width=600,height=700,scale=1,center=300,top=14,left=0,right=600,cardWidth=360,cardHeight=440,opacity=1,flags=(light?1:0)|(lang=="ar"?2:0)|(acrylic?4:0)|8};
    Check(f.cardHeight>f.cardWidth,"Expanded card must be portrait");
    foreach(bool open in new[]{true,false}){var s=new MotionApi.Snapshot{body=open?0:1,drop=open?0:1,visible=0,blink=1};MotionApi.MotionPose(engine,ref s);
     for(int frame=0;frame<45;frame++){if(frame>0)MotionApi.MotionStep(engine,1f/60,0,0,0,-1,open?1:0,out s);
      string name=(open?"open":"close")+"-"+frame.ToString("D2"),file=Path.Combine(dir,name+".png");MotionApi.Check(MotionApi.MotionDraw(engine,ref f,"10:42",lang=="ar"?"الجمعة، ٣٠ أكتوبر":"Friday, 30 October",file));using(var image=new Bitmap(file)){Audit(image,f,s,light,scene+"/"+name);
       if(frame==0){image.SetPixel(0,0,Color.White);bool rejected=false;try{Audit(image,f,s,light,"injected-white-rectangle");}catch(Exception){rejected=true;}Check(rejected,"QA failed to reject an injected exterior white pixel");}
      }count++;
      rows.Add(new{scene=scene,direction=open?"open":"close",frame=frame,timeMs=frame*1000.0/60,body=s.body,drop=s.drop,file=file});
     }
    }
   }
  }finally{MotionApi.MotionDestroy(engine);}}
  File.WriteAllText(Path.Combine(args[0],"shape-audit.json"),new JavaScriptSerializer{MaxJsonLength=16000000}.Serialize(new{frames=count,leakingPixels=0,method="Every RGBA pixel against independent rounded/droplet mask, all45open+45close60Hz frames; one physical pixel raster edge; exterior alpha exactly0",rows=rows}));Console.WriteLine("T24 SHAPE PASS: "+count+" exact-exterior alpha frames, RTL/LTR x light/dark x acrylic/glass");return 0;
 }catch(Exception e){Console.Error.WriteLine(e);return 1;}}
}
