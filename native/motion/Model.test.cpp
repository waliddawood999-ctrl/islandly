#include "Model.h"
#include "FrameClock.h"
#include "PropertyCache.h"
#include "WindowEvents.h"
#include <cassert>
#include <iostream>
int main(){
 // Cursor object (-9) and child/control events must not cross into the CLR,
 // even when Windows attributes them to the foreground thread.
 for(unsigned event:{0x800au,0x800bu}){
  assert(motion::windowObjectEvent(event,0,0,true));
  assert(!motion::windowObjectEvent(event,-9,0,true));
  assert(!motion::windowObjectEvent(event,0,1,true));
  assert(!motion::windowObjectEvent(event,0,0,false));
 }
 assert(!motion::windowObjectEvent(0x800c,0,0,true));
 motion::PropertyCache<9> properties;
 for(unsigned i=0;i<9;i++){assert(properties.changed(i,float(i)));assert(!properties.changed(i,float(i)));assert(properties.changed(i,float(i)+.00001f));}
 properties.invalidate(0);assert(properties.changed(0,properties[0]));assert(!properties.changed(1,properties[1]));
 properties.invalidate();for(unsigned i=0;i<9;i++)assert(properties.changed(i,properties[i]));
 motion::Model m;m.target(true);for(int i=0;i<100;i++)m.step(.001);assert(std::abs(m.body.x-.723)<.025);assert(m.drop.x>1.1);
 double x=m.body.x,v=m.body.v;m.target(false);assert(m.body.x==x&&m.body.v==v);m.step(.001);assert(std::abs(m.body.x-x)<.007);
 for(int i=0;i<1000;i++)m.step(.001);assert(std::abs(m.body.x)<.002);
 for(auto p:{std::pair<double,double>{-170,0},{170,0},{-120,85},{120,85},{0,95},{330,180}}){motion::Model e;e.eyes=true;e.pointer(p.first,p.second,true,false);for(int i=0;i<2000;i++)e.step(.001);assert(std::abs(std::atan2(e.gy,e.gx)-std::atan2(p.second,p.first))<.07);assert(std::abs(e.gx)<=1&&std::abs(e.gy)<=1);}
 m=motion::Model();m.eyes=true;assert(m.eyeVisible());m.fullscreen=true;assert(!m.eyeVisible());m.fullscreen=false;m.eco=true;assert(!m.eyeVisible());m.eco=false;m.mode=2;assert(!m.eyeVisible());m.mode=1;m.pointer(170,0,true,true);m.step(.1);assert(m.gx==0&&m.lid==0);
 m=motion::Model();m.target(true);m.step(.1);auto s=motion::shape(m,-1900,14,-1920,0);assert(s.x>=-1908);assert(s.x+s.w<=-12);assert(s.bulge>0);
 for(double hz:{60.,144.}){motion::Model a;a.target(true);for(int i=0;i<3*hz;i++)a.step(1/hz);assert(std::abs(a.body.x-1)<.0001);}
 // A collapsed anticipatory drop has a nonzero target. Eco/Reduced project
 // drop onto body rather than integrating it: that disabled spring must not keep
 // the Win32 frame worker alive forever after body reaches rest.
 for(int policy=0;policy<3;policy++){
  motion::Model e;e.eyes=true;e.anticipation=.1;e.target(false);
  for(int i=0;i<100;i++)e.step(.001);
  e.eco=policy==0;e.mode=policy==1?1:policy==2?2:0;e.target(false);
  for(int i=0;i<1000;i++)e.step(.001);
  assert(!e.moving());
 }
 // Production producer clock: refresh adaptation, absolute (not accumulated)
 // deadlines under jitter, no catch-up spin, and a fresh anchor after idle.
 motion::FrameClock clock;clock.refresh(60);assert(clock.period==15);
 assert(clock.deadline(0)==15);assert(clock.deadline(15.4)==30);
 assert(clock.deadline(50)==50);assert(clock.deadline(50)==65);
 assert(clock.deadline(1000)==1015);
 clock.refresh(144);assert(std::abs(clock.period-6.25)<.0001);
 assert(std::abs(clock.deadline(2000)-2006.25)<.0001);
 clock.refresh(0);assert(clock.period==15);
 std::cout<<"native model: springs/reversal, physical gaze, hidden/reduced policies, secondary-screen clamp and 60/144 Hz passed\n";
}
