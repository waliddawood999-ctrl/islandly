#pragma once
#include <array>
namespace motion {
// Gaze/squash/rotation in slot-local coordinates. Blink remains an independent
// compositor scale about the source capsule centre (16,20).
inline std::array<float,6> eyePose(float sx,float sy,float centreY,float dpi){
 constexpr float c=.981627183447664f,s=-.190808995376545f; // -11 degrees
 float a=sx*c,b=sx*s,u=-sy*s,v=sy*c;
 return {a,b,u,v,-16*dpi*a-20*dpi*u,centreY-16*dpi*b-20*dpi*v};
}
}
