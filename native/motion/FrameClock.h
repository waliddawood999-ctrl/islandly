#pragma once
#include <algorithm>
#include <cmath>
namespace motion {
// A presentation fence may block for multiple display periods; it is not a
// producer clock. Keep refresh-derived absolute deadlines, with dispatch room.
struct FrameClock {
 double period=15,next=0,last=-1;
 void refresh(double hz){period=std::isfinite(hz)&&hz>=20&&hz<=1000?std::min(15.,900./hz):15.;}
 bool idle(double now)const{return last<0||now-last>4*period;}
 double deadline(double now){if(idle(now))next=now;last=now;next+=period;if(next<=now)next=now;return next;}
};
}
