#pragma once
#include <array>
namespace motion {
// Exact comparisons: this avoids redundant compositor commands, not movement.
template<unsigned N> struct PropertyCache {
 std::array<float,N> values{};std::array<bool,N> valid{};
 bool changed(unsigned i,float value){if(valid[i]&&values[i]==value)return false;values[i]=value;valid[i]=true;return true;}
 float operator[](unsigned i)const{return values[i];}
 void invalidate(){valid.fill(false);}
 void invalidate(unsigned i){valid[i]=false;}
};
}
