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
 std::cout<<"native model: springs/reversal, physical gaze, hidden/reduced policies, secondary-screen clamp and 60/144 Hz passed\n";
}
