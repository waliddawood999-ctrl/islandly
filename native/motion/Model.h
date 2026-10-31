#pragma once
#include <cmath>
#include <algorithm>
namespace motion {
// Collapsed island and expanded-card geometry in DIP (multiplied by scale). Mirrored in native/Motion.cs (IslandGeometry): change both together.
constexpr double kIslandW=168,kIslandH=34,kIslandR=10,kCardR=14;
// First-reveal liquid drop: 900 ms, or a 150 ms opacity fade in eco / reduced motion.
constexpr double kIntroTotal=.9,kIntroFade=.15;
inline double clamp(double x,double a,double b){return std::max(a,std::min(b,x));}
inline double easeOutCubic(double u){double v=1-clamp(u,0,1);return 1-v*v*v;}
inline double easeOutBack(double u){double v=clamp(u,0,1)-1;return 1+2*v*v*v+v*v;} // overshoot parameter 1: peak 1.037
// CSS cubic-bezier(x1,y1,x2,y2) with the end points fixed at (0,0) and (1,1): bisection on x(s), fixed iteration count.
inline double cubicBezier(double x,double x1,double y1,double x2,double y2){x=clamp(x,0,1);double lo=0,hi=1,s=x;
 for(int i=0;i<24;i++){s=(lo+hi)/2;double u=1-s,cx=3*u*u*s*x1+3*u*s*s*x2+s*s*s;if(cx<x)lo=s;else hi=s;}
 double u=1-s;return 3*u*u*s*y1+3*u*s*s*y2+s*s*s;}
struct Spring {
 double x=0,v=0,target=0,k,c;
 Spring(double stiffness,double damping):k(stiffness),c(damping){}
 void step(double dt){while(dt>0){double h=std::min(dt,.001);v+=(k*(target-x)-c*v)*h;x+=v*h;dt-=h;}}
 bool moving()const{return std::abs(x-target)>.0001||std::abs(v)>.002;}
};
struct Model {
 Spring body{520,40},drop{900,28};
 double gx=0,gy=0,lid=0,squint=0,blink=0,age=0,blinkStart=-1,nextBlink=3.5,reducedAge=0,anticipation=0,introT=-1;
 int mode=0;bool eco=false,eyes=false,fullscreen=false,compact=false,nearby=false,on=false,opening=false,introUsed=false,introAsk=false,introFade=false;
 double tx=0,ty=0;
 bool eyeVisible()const{return eyes&&!eco&&mode!=2&&!fullscreen&&!compact&&body.x<=.05;}
 // The intro plays once per process: the first request starts it at the next step (eco and mode are read then); motion "off" never plays it.
 void intro(){if(introUsed)return;introUsed=true;introAsk=true;}
 bool introActive()const{return introT>=0;}
 double introContent()const{return introT<0||introFade?1:clamp((introT-.75)/.15,0,1);} // eyes and clock fade in during the last 150 ms
 double introOpacity()const{return introT<0||!introFade?1:clamp(introT/kIntroFade,0,1);}
 void stepIntro(double dt){if(introAsk){introAsk=false;if(mode!=2){introT=0;introFade=eco||mode==1;}}
  if(introT>=0){introT+=dt;if(introT>=(introFade?kIntroFade:kIntroTotal))introT=-1;}}
 void target(bool open){if(open!=opening)reducedAge=0;opening=open;if(open)introT=-1;body.target=open?1:0;drop.target=open?1:anticipation;}
 void pointer(double dx,double dy,bool valid,bool over){double distance=std::hypot(dx,dy);nearby=valid&&distance<240;on=over;
  double t=clamp(distance/50,0,1);t=t*t*(3-2*t);double gain=nearby?1:.6;
  tx=valid&&distance>0?dx/distance*t*gain:0;ty=valid&&distance>0?dy/distance*t*gain:0;
 }
 void step(double dt){dt=clamp(dt,0,.25);age+=dt;stepIntro(dt);
  if(mode==2){body.x=body.target;body.v=0;if(reducedAge>=.12)body.x=body.target;drop.x=body.x;drop.v=0;}
  else if(mode==1||eco){reducedAge+=dt;body.x+=(body.target-body.x)*(1-std::exp(-dt/.04));body.v=0;if(reducedAge>=.12)body.x=body.target;drop.x=body.x;drop.v=0;}
  else{body.step(dt);drop.step(dt);}
  if(!eyeVisible()||mode==1){gx=gy=lid=squint=blink=0;blinkStart=-1;nextBlink=age+3.5;return;}
  gx+=(tx-gx)*(1-std::exp(-4*dt));gy+=(ty-gy)*(1-std::exp(-4*dt));
  double toLid=nearby?0:.54;lid+=(toLid-lid)*(1-std::exp(-dt/(nearby?.07:.22)));
  squint+=((on?1:0)-squint)*(1-std::exp(-dt/.09));
  if(age>=nextBlink&&blinkStart<0)blinkStart=age;
  if(blinkStart>=0){double u=(age-blinkStart)/(nearby?.28:.38);if(u>=1){blinkStart=-1;blink=0;nextBlink=age+(nearby?3.2:11.2);}else{double c=u<.4?std::pow(u/.4,2):u<.48?1:std::pow(1-(u-.48)/.52,2);blink=1-.9*c;}}
  else blink=1;
 }
 bool moving()const{return body.moving()||drop.moving()||introT>=0;}
};
// nw0/nw1: width of the gooey neck at the screen edge / at the drop (0 = no neck). The neck belongs to the same outline as the body.
struct Shape {double x,y,w,h,r,bulge,wl,nw0=0,nw1=0;};
// Liquid-drop intro (t in seconds, resting top = top): emerge 0-150 ms, stretch/fall 150-450 (neck 10 -> 4), snap 450-520 (neck pinches off, +3 px overshoot settling as a zeta .5 spring), morph 520-900 (14x14 r7 -> island; height and radius start 60 ms later).
inline Shape introShape(const Model&m,double center,double top,double screenLeft,double screenRight){
 const double t=m.introT,d=14;double w=d,h=d,r=d/2,y=0,neck=0;
 if(t<.15){w=h=d*easeOutCubic(t/.15);r=w/2;}
 else if(t<.45){y=top*cubicBezier((t-.15)/.3,.55,0,.2,1);neck=1;}
 else{double q=t-.45;y=top;if(t<.52)neck=1-q/.07;
  // Closed-form underdamped spring, zeta .5, normalised so the first peak (q=.07, the end of the snap) is +3 px; independent of the frame rate.
  const double phi=1.0471975511965976,zeta=.5,wd=phi/.07,decay=zeta*wd/std::sqrt(1-zeta*zeta),peak=std::exp(-decay*.07)*std::sin(wd*.07);
  y+=3/peak*std::exp(-decay*q)*std::sin(wd*q);
  if(t>=.52){w=d+(kIslandW-d)*easeOutBack((t-.52)/.38);double u=easeOutCubic((t-.58)/.32);h=d+(kIslandH-d)*u;r=d/2+(kIslandR-d/2)*u;}}
 Shape s;s.w=std::max(0.,w);s.h=std::max(0.,h);s.r=std::max(0.,std::min(r,std::min(s.w,s.h)/2));
 s.x=clamp(center-s.w/2,screenLeft+12,screenRight-12-s.w);s.y=std::max(0.,y);s.bulge=0;s.wl=0;
 if(neck>0&&s.y>.5){s.nw0=10*neck;s.nw1=4*neck;}
 return s;
}
inline Shape shape(const Model&m,double center,double top,double screenLeft,double screenRight,double width=360,double height=440,double anticipation=0){
 if(m.introActive()&&!m.introFade)return introShape(m,center,top,screenLeft,screenRight);
 double f=m.body.x;Shape s;s.w=kIslandW+(width-kIslandW)*f;s.h=kIslandH+(height-kIslandH)*f;s.r=kIslandR+(kCardR-kIslandR)*clamp(f,0,1);
 s.w=std::max(36.,s.w);s.h=std::max(5.,s.h);s.r=std::min(s.r,std::min(s.w,s.h)/2);
 s.x=clamp(center-s.w/2,screenLeft+12,screenRight-12-s.w);s.y=top;
 s.bulge=m.mode||m.eco?0:std::max(0.,m.drop.x+anticipation-f)*164;
 s.wl=std::max(0.,std::min(.3*s.w,s.w/2-s.r-4));return s;
}
}
