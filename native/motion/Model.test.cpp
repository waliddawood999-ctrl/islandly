#include "Model.h"
#include <cassert>
#include <iostream>
int main(){
 motion::Model m;m.target(true);for(int i=0;i<100;i++)m.step(.001);assert(std::abs(m.body.x-.723)<.025);assert(m.drop.x>1.1);
 double x=m.body.x,v=m.body.v;m.target(false);assert(m.body.x==x&&m.body.v==v);m.step(.001);assert(std::abs(m.body.x-x)<.007);
 for(int i=0;i<1000;i++)m.step(.001);assert(std::abs(m.body.x)<.002);
 for(auto p:{std::pair<double,double>{-170,0},{170,0},{-120,85},{120,85},{0,95},{330,180}}){motion::Model e;e.eyes=true;e.pointer(p.first,p.second,true,false);for(int i=0;i<2000;i++)e.step(.001);assert(std::abs(std::atan2(e.gy,e.gx)-std::atan2(p.second,p.first))<.07);assert(std::abs(e.gx)<=1&&std::abs(e.gy)<=1);}
 m=motion::Model();m.eyes=true;assert(m.eyeVisible());m.fullscreen=true;assert(!m.eyeVisible());m.fullscreen=false;m.eco=true;assert(!m.eyeVisible());m.eco=false;m.mode=2;assert(!m.eyeVisible());m.mode=1;m.pointer(170,0,true,true);m.step(.1);assert(m.gx==0&&m.lid==0);
 m=motion::Model();m.target(true);m.step(.1);auto s=motion::shape(m,-1900,14,-1920,0);assert(s.x>=-1908);assert(s.x+s.w<=-12);assert(s.bulge>0);
 for(double hz:{60.,144.}){motion::Model a;a.target(true);for(int i=0;i<3*hz;i++)a.step(1/hz);assert(std::abs(a.body.x-1)<.0001);}
 // T23: rectangular island. Collapsed 168x34 r10, expanded card r14, radius linear in body.x.
 {motion::Model r;auto c=motion::shape(r,500,8,0,1000);assert(c.w==168&&c.h==34&&c.r==10&&c.nw0==0&&c.nw1==0);
  r.body.x=1;auto e=motion::shape(r,500,8,0,1000);assert(e.w==360&&e.h==440&&e.r==14);
  r.body.x=.5;assert(std::abs(motion::shape(r,500,8,0,1000).r-12)<1e-9);
  assert(motion::kIslandW==168&&motion::kIslandH==34&&motion::kIslandR==10&&motion::kCardR==14);}
 // T23: liquid-drop intro, sampled every 16 ms from 0 to 900 ms (and at 144 Hz): finite, never negative, neck only before the snap ends, ends exactly at the collapsed shape.
 for(double dt:{.016,1/144.}){motion::Model d;d.intro();d.step(0);assert(d.introActive()&&!d.introFade&&d.moving());
  auto first=motion::shape(d,500,8,0,1000);assert(first.w==0&&first.h==0&&first.y==0&&first.nw0==0);
  double maxW=0,t=0;bool neck=false,grewPastDrop=false;int samples=0;
  while(d.introActive()){auto s=motion::shape(d,500,8,0,1000);samples++;
   for(double v:{s.x,s.y,s.w,s.h,s.r,s.bulge,s.wl,s.nw0,s.nw1})assert(std::isfinite(v));
   assert(s.w>=0&&s.h>=0&&s.r>=0&&s.y>=0&&s.y<=8+3.01&&s.r<=std::min(s.w,s.h)/2+1e-9);
   assert(s.x>=12&&s.x+s.w<=988+1e-9);
   if(s.nw0>0){neck=true;assert(t<.52+1e-9&&s.nw0<=10&&s.nw1<=4&&s.y>.5);}
   if(t>=.52)assert(s.w>=14-1e-9&&s.h>=14-1e-9);
   if(s.w>14.5)grewPastDrop=true;maxW=std::max(maxW,s.w);
   assert(d.introContent()>=0&&d.introContent()<=1&&d.introOpacity()==1);
   if(t<.75)assert(d.introContent()==0);
   d.step(dt);t+=dt;assert(t<1.5);}
  assert(neck&&grewPastDrop&&samples>=56&&maxW<=168*1.04&&maxW>168);
  auto done=motion::shape(d,500,8,0,1000);assert(done.w==168&&done.h==34&&done.r==10&&done.y==8&&done.nw0==0&&done.nw1==0&&d.introContent()==1);
  assert(!d.moving());d.intro();d.step(0);assert(!d.introActive()); /* once per process */}
 // T23: the stretch phase is well formed too: the drop is at the resting top when the snap starts, and the neck is 10 -> 4 wide.
 {motion::Model d;d.intro();d.step(0);d.step(.3);auto mid=motion::shape(d,500,8,0,1000);assert(mid.nw0==10&&mid.nw1==4&&mid.w==14&&mid.h==14&&mid.y>0&&mid.y<8);
  d.step(.15);auto snap=motion::shape(d,500,8,0,1000);assert(std::abs(snap.y-8)<1e-3&&snap.nw0>9.9&&snap.nw1>3.9);}
 // T23: eco and reduced motion skip the drop and fade the (final-shaped) island in over 150 ms; motion off plays nothing.
 for(int kind=0;kind<2;kind++){motion::Model e;if(kind==0)e.eco=true;else e.mode=1;e.intro();e.step(0);assert(e.introActive()&&e.introFade);
  double last=-1;for(int i=0;i<20&&e.introActive();i++){auto s=motion::shape(e,500,8,0,1000);assert(s.w==168&&s.h==34&&s.r==10&&s.nw0==0&&s.y==8);
   double o=e.introOpacity();assert(o>=last&&o>=0&&o<=1&&e.introContent()==1);last=o;e.step(.016);}
  assert(!e.introActive()&&e.introOpacity()==1&&last<1&&last>=0);}
 {motion::Model o;o.mode=2;o.intro();o.step(0);assert(!o.introActive()&&!o.moving());}
 // T23: opening the panel before the first reveal ever played cancels a running intro.
 {motion::Model c;c.intro();c.step(.1);assert(c.introActive());c.target(true);assert(!c.introActive());}
 std::cout<<"native model: springs/reversal, physical gaze, hidden/reduced policies, secondary-screen clamp, 60/144 Hz, rectangular island, liquid-drop intro and eco/reduced fade passed\n";
}
