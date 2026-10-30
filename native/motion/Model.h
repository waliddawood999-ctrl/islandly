#pragma once
#include <cmath>
#include <algorithm>
namespace motion {
inline double clamp(double x,double a,double b){return std::max(a,std::min(b,x));}
struct Spring {
 double x=0,v=0,target=0,k,c;
 Spring(double stiffness,double damping):k(stiffness),c(damping){}
 void step(double dt){while(dt>0){double h=std::min(dt,.001);v+=(k*(target-x)-c*v)*h;x+=v*h;dt-=h;}}
 bool moving()const{return std::abs(x-target)>.0001||std::abs(v)>.002;}
};
struct Model {
 Spring body{520,40},drop{900,28};
 double gx=0,gy=0,lid=0,squint=0,blink=0,age=0,blinkStart=-1,nextBlink=3.5,reducedAge=0;
 int mode=0;bool eco=false,eyes=false,fullscreen=false,compact=false,nearby=false,on=false,opening=false;
 double tx=0,ty=0;
 bool eyeVisible()const{return eyes&&!eco&&mode!=2&&!fullscreen&&!compact&&body.x<=.05&&!opening;}
 void target(bool open){if(open!=opening)reducedAge=0;opening=open;body.target=drop.target=open?1:0;}
 void pointer(double dx,double dy,bool valid,bool over){double distance=std::hypot(dx,dy);nearby=valid&&distance<240;on=over;
  double t=clamp(distance/50,0,1);t=t*t*(3-2*t);double gain=nearby?1:.6;
  tx=valid&&distance>0?dx/distance*t*gain:0;ty=valid&&distance>0?dy/distance*t*gain:0;
 }
 void step(double dt){dt=clamp(dt,0,.25);age+=dt;
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
 bool moving()const{return body.moving()||drop.moving();}
};
struct Shape {double x,y,w,h,r,bulge,wl;};
inline Shape shape(const Model&m,double center,double top,double screenLeft,double screenRight,double width=440,double height=200,double anticipation=0){
 double f=m.body.x;Shape s;s.w=138+(width-138)*f;s.h=36+(height-36)*f;s.r=18+4*clamp(f,0,1);
 s.w=std::max(36.,s.w);s.h=std::max(5.,s.h);s.r=std::min(s.r,std::min(s.w,s.h)/2);
 s.x=clamp(center-s.w/2,screenLeft+12,screenRight-12-s.w);s.y=top;
 s.bulge=m.mode||m.eco?0:std::max(0.,m.drop.x+anticipation-f)*(height-36);
 s.wl=std::max(0.,std::min(.3*s.w,s.w/2-s.r-4));return s;
}
}
