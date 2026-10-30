#pragma once
namespace motion {
inline bool windowObjectEvent(unsigned event,int object,int child,bool foreground){
 return (event==0x800a||event==0x800b)&&object==0&&child==0&&foreground;
}
}
