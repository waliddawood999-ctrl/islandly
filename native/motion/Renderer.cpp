#define NOMINMAX
#define UNICODE
#define _UNICODE
#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <d2d1_1.h>
#include <d2d1_1helper.h>
#include <dcomp.h>
#include <dwmapi.h>
#include <dwrite.h>
#include <wincodec.h>
#include <wrl/client.h>
#include <vector>
#include "Model.h"
#undef DrawText
using Microsoft::WRL::ComPtr;
struct Snapshot {float body,drop,gx,gy,lid,squint,blink;int visible,moving;};
struct Frame {float width,height,scale,center,top,left,right,cardWidth,cardHeight,anticipation,opacity;int flags;};
struct OutlineSink:ID2D1SimplifiedGeometrySink {
 ULONG refs=1;std::vector<POINT> points;
 HRESULT STDMETHODCALLTYPE QueryInterface(REFIID id,void**p)override{if(id==__uuidof(IUnknown)||id==__uuidof(ID2D1SimplifiedGeometrySink)){*p=this;AddRef();return S_OK;}*p=nullptr;return E_NOINTERFACE;}
 ULONG STDMETHODCALLTYPE AddRef()override{return ++refs;} ULONG STDMETHODCALLTYPE Release()override{ULONG n=--refs;if(!n)delete this;return n;}
 void STDMETHODCALLTYPE SetFillMode(D2D1_FILL_MODE)override{} void STDMETHODCALLTYPE SetSegmentFlags(D2D1_PATH_SEGMENT)override{}
 void add(D2D1_POINT_2F p){points.push_back({LONG(std::lround(p.x)),LONG(std::lround(p.y))});}
 void STDMETHODCALLTYPE BeginFigure(D2D1_POINT_2F p,D2D1_FIGURE_BEGIN)override{add(p);}
 void STDMETHODCALLTYPE AddLines(const D2D1_POINT_2F*p,UINT n)override{for(UINT i=0;i<n;i++)add(p[i]);}
 void STDMETHODCALLTYPE AddBeziers(const D2D1_BEZIER_SEGMENT*,UINT)override{}
 void STDMETHODCALLTYPE EndFigure(D2D1_FIGURE_END)override{} HRESULT STDMETHODCALLTYPE Close()override{return S_OK;}
};
struct Renderer {
 HWND window;motion::Model model;
 ComPtr<ID3D11Device> gpu;ComPtr<ID3D11DeviceContext> gpuContext;ComPtr<IDXGISwapChain1> swap;
 ComPtr<ID2D1Factory1> factory;ComPtr<ID2D1Device> device;ComPtr<ID2D1DeviceContext> dc;
 ComPtr<IDCompositionEffectGroup> opacity;ComPtr<IDCompositionDevice> composition;ComPtr<IDCompositionTarget> target;ComPtr<IDCompositionVisual> visual;
 ComPtr<IDWriteFactory> text;ComPtr<ID2D1SolidColorBrush> brush;UINT width=0,height=0;
 HRESULT initialize(HWND hwnd){window=hwnd;UINT flags=D3D11_CREATE_DEVICE_BGRA_SUPPORT;
  HRESULT hr=D3D11CreateDevice(nullptr,D3D_DRIVER_TYPE_HARDWARE,nullptr,flags,nullptr,0,D3D11_SDK_VERSION,&gpu,nullptr,&gpuContext);
  if(FAILED(hr))hr=D3D11CreateDevice(nullptr,D3D_DRIVER_TYPE_WARP,nullptr,flags,nullptr,0,D3D11_SDK_VERSION,&gpu,nullptr,&gpuContext);
  if(FAILED(hr))return hr;ComPtr<IDXGIDevice> dxgi;hr=gpu.As(&dxgi);if(FAILED(hr))return hr;
  hr=D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED,__uuidof(ID2D1Factory1),nullptr,reinterpret_cast<void**>(factory.GetAddressOf()));if(FAILED(hr))return hr;
  hr=factory->CreateDevice(dxgi.Get(),&device);if(FAILED(hr))return hr;hr=device->CreateDeviceContext(D2D1_DEVICE_CONTEXT_OPTIONS_NONE,&dc);if(FAILED(hr))return hr;
  hr=DCompositionCreateDevice(dxgi.Get(),__uuidof(IDCompositionDevice),reinterpret_cast<void**>(composition.GetAddressOf()));if(FAILED(hr))return hr;
  hr=composition->CreateTargetForHwnd(hwnd,TRUE,&target);if(FAILED(hr))return hr;hr=composition->CreateVisual(&visual);if(FAILED(hr))return hr;
  hr=composition->CreateEffectGroup(&opacity);if(FAILED(hr))return hr;hr=visual->SetEffect(opacity.Get());if(FAILED(hr))return hr;
  hr=target->SetRoot(visual.Get());if(FAILED(hr))return hr;
  hr=DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED,__uuidof(IDWriteFactory),reinterpret_cast<IUnknown**>(text.GetAddressOf()));if(FAILED(hr))return hr;
  return dc->CreateSolidColorBrush(D2D1::ColorF(1,1,1,1),&brush);
 }
 HRESULT resize(UINT w,UINT h){if(width==w&&height==h)return S_OK;dc->SetTarget(nullptr);HRESULT hr;
  if(swap)hr=swap->ResizeBuffers(2,w,h,DXGI_FORMAT_B8G8R8A8_UNORM,0);
  else {ComPtr<IDXGIDevice> dxgi;gpu.As(&dxgi);ComPtr<IDXGIAdapter> adapter;dxgi->GetAdapter(&adapter);ComPtr<IDXGIFactory2> f;adapter->GetParent(IID_PPV_ARGS(&f));
   DXGI_SWAP_CHAIN_DESC1 desc={};desc.Width=w;desc.Height=h;desc.Format=DXGI_FORMAT_B8G8R8A8_UNORM;desc.SampleDesc.Count=1;desc.BufferUsage=DXGI_USAGE_RENDER_TARGET_OUTPUT;desc.BufferCount=2;desc.SwapEffect=DXGI_SWAP_EFFECT_FLIP_SEQUENTIAL;desc.AlphaMode=DXGI_ALPHA_MODE_PREMULTIPLIED;
   hr=f->CreateSwapChainForComposition(gpu.Get(),&desc,nullptr,&swap);if(SUCCEEDED(hr))hr=visual->SetContent(swap.Get());}
  if(FAILED(hr))return hr;ComPtr<IDXGISurface> surface;hr=swap->GetBuffer(0,IID_PPV_ARGS(&surface));if(FAILED(hr))return hr;
  ComPtr<ID2D1Bitmap1> bitmap;auto props=D2D1::BitmapProperties1(D2D1_BITMAP_OPTIONS_TARGET|D2D1_BITMAP_OPTIONS_CANNOT_DRAW,D2D1::PixelFormat(DXGI_FORMAT_B8G8R8A8_UNORM,D2D1_ALPHA_MODE_PREMULTIPLIED),96,96);
  hr=dc->CreateBitmapFromDxgiSurface(surface.Get(),&props,&bitmap);if(FAILED(hr))return hr;dc->SetTarget(bitmap.Get());width=w;height=h;return composition->Commit();
 }
 ComPtr<ID2D1PathGeometry> outline(const motion::Shape&s){ComPtr<ID2D1PathGeometry> p;factory->CreatePathGeometry(&p);ComPtr<ID2D1GeometrySink> sink;p->Open(&sink);
  float x=float(s.x),y=float(s.y),w=float(s.w),h=float(s.h),r=float(s.r),q=r*.55228475f,c=x+w/2,l=float(s.wl),b=float(s.bulge);
  auto point=[](float a,float z){return D2D1::Point2F(a,z);};
  sink->BeginFigure(point(x+r,y),D2D1_FIGURE_BEGIN_FILLED);sink->AddLine(point(x+w-r,y));
  sink->AddBezier(D2D1::BezierSegment(point(x+w-r+q,y),point(x+w,y+r-q),point(x+w,y+r)));sink->AddLine(point(x+w,y+h-r));
  sink->AddBezier(D2D1::BezierSegment(point(x+w,y+h-r+q),point(x+w-r+q,y+h),point(x+w-r,y+h)));
  if(b>.5f&&l>0){sink->AddLine(point(c+l,y+h));sink->AddBezier(D2D1::BezierSegment(point(c+.5f*l,y+h),point(c+.55f*l,y+h+b),point(c,y+h+b)));sink->AddBezier(D2D1::BezierSegment(point(c-.55f*l,y+h+b),point(c-.5f*l,y+h),point(c-l,y+h)));}
  sink->AddLine(point(x+r,y+h));sink->AddBezier(D2D1::BezierSegment(point(x+r-q,y+h),point(x,y+h-r+q),point(x,y+h-r)));sink->AddLine(point(x,y+r));
  sink->AddBezier(D2D1::BezierSegment(point(x,y+r-q),point(x+r-q,y),point(x+r,y)));sink->EndFigure(D2D1_FIGURE_END_CLOSED);sink->Close();return p;
 }
 void label(const wchar_t*value,float size,D2D1_RECT_F rect,bool rtl,float alpha,bool light){if(!value||!*value||alpha<=0)return;ComPtr<IDWriteTextFormat> format;
  if(FAILED(text->CreateTextFormat(L"Segoe UI",nullptr,DWRITE_FONT_WEIGHT_NORMAL,DWRITE_FONT_STYLE_NORMAL,DWRITE_FONT_STRETCH_NORMAL,size,L"ar-SA",&format)))return;
  format->SetReadingDirection(rtl?DWRITE_READING_DIRECTION_RIGHT_TO_LEFT:DWRITE_READING_DIRECTION_LEFT_TO_RIGHT);format->SetTextAlignment(DWRITE_TEXT_ALIGNMENT_CENTER);format->SetParagraphAlignment(DWRITE_PARAGRAPH_ALIGNMENT_CENTER);format->SetWordWrapping(DWRITE_WORD_WRAPPING_NO_WRAP);
  brush->SetColor(light?D2D1::ColorF(12/255.f,12/255.f,18/255.f,alpha):D2D1::ColorF(247/255.f,248/255.f,252/255.f,alpha));
  dc->DrawTextW(value,UINT32(wcslen(value)),format.Get(),rect,brush.Get(),D2D1_DRAW_TEXT_OPTIONS_CLIP);
 }
 HRESULT capture(const wchar_t*file){if(!file||!*file)return S_OK;ComPtr<ID3D11Texture2D> back;HRESULT hr=swap->GetBuffer(0,IID_PPV_ARGS(&back));if(FAILED(hr))return hr;
  D3D11_TEXTURE2D_DESC desc;back->GetDesc(&desc);desc.BindFlags=0;desc.CPUAccessFlags=D3D11_CPU_ACCESS_READ;desc.Usage=D3D11_USAGE_STAGING;desc.MiscFlags=0;
  ComPtr<ID3D11Texture2D> staging;hr=gpu->CreateTexture2D(&desc,nullptr,&staging);if(FAILED(hr))return hr;gpuContext->CopyResource(staging.Get(),back.Get());D3D11_MAPPED_SUBRESOURCE pixels;
  hr=gpuContext->Map(staging.Get(),0,D3D11_MAP_READ,0,&pixels);if(FAILED(hr))return hr;
  ComPtr<IWICImagingFactory> wic;ComPtr<IWICStream> stream;ComPtr<IWICBitmapEncoder> encoder;ComPtr<IWICBitmapFrameEncode> frame;ComPtr<IPropertyBag2> options;
  hr=CoCreateInstance(CLSID_WICImagingFactory,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&wic));
  if(SUCCEEDED(hr))hr=wic->CreateStream(&stream);if(SUCCEEDED(hr))hr=stream->InitializeFromFilename(file,GENERIC_WRITE);if(SUCCEEDED(hr))hr=wic->CreateEncoder(GUID_ContainerFormatPng,nullptr,&encoder);if(SUCCEEDED(hr))hr=encoder->Initialize(stream.Get(),WICBitmapEncoderNoCache);if(SUCCEEDED(hr))hr=encoder->CreateNewFrame(&frame,&options);if(SUCCEEDED(hr))hr=frame->Initialize(options.Get());if(SUCCEEDED(hr))hr=frame->SetSize(width,height);
  WICPixelFormatGUID format=GUID_WICPixelFormat32bppPBGRA;if(SUCCEEDED(hr))hr=frame->SetPixelFormat(&format);if(SUCCEEDED(hr))hr=frame->WritePixels(height,pixels.RowPitch,pixels.RowPitch*height,static_cast<BYTE*>(pixels.pData));if(SUCCEEDED(hr))hr=frame->Commit();if(SUCCEEDED(hr))hr=encoder->Commit();gpuContext->Unmap(staging.Get(),0);return hr;
 }
 HRESULT draw(const Frame&f,const wchar_t*clock,const wchar_t*date,const wchar_t*file){HRESULT hr=resize(UINT(f.width),UINT(f.height));if(FAILED(hr))return hr;
  bool light=(f.flags&1)!=0,rtl=(f.flags&2)!=0,acrylic=(f.flags&4)!=0,floating=(f.flags&8)!=0;
  auto s=motion::shape(model,f.center,f.top,f.left,f.right,f.cardWidth,f.cardHeight,f.anticipation);if((f.flags&16)&&model.body.x<.001){s.w=84;s.h=5;s.r=2.5;s.bulge=0;s.x=motion::clamp(f.center-42,f.left+12,f.right-12-84);}
  s.bulge=std::min(s.bulge,std::max(0.,f.height/f.scale-s.y-s.h-1));
  auto path=outline(s);
  auto scale=D2D1::Matrix3x2F::Scale(f.scale,f.scale);dc->SetTransform(scale);dc->BeginDraw();
  D2D1_RECT_F dirty=D2D1::RectF(float(s.x)+(rtl?78.f:2.f),float(s.y),float(s.x)+(rtl?136.f:60.f),float(s.y)+36);
  if(f.flags&32)dc->PushAxisAlignedClip(dirty,D2D1_ANTIALIAS_MODE_ALIASED);
  dc->Clear(D2D1::ColorF(0,0,0,0));
  brush->SetColor(light?D2D1::ColorF(.94f,.94f,.96f,acrylic?.46f:.94f):D2D1::ColorF(12/255.f,12/255.f,15/255.f,acrylic?.46f:.9f));dc->FillGeometry(path.Get(),brush.Get());
  ComPtr<ID2D1Layer> layer;dc->CreateLayer(&layer);dc->PushLayer(D2D1::LayerParameters(D2D1::InfiniteRect(),path.Get()),layer.Get());
  brush->SetColor(D2D1::ColorF(1,1,1,floating?.06f:.12f));dc->DrawGeometry(path.Get(),brush.Get(),floating?4.f:.5f);
  float a=float(motion::clamp(1-model.body.x/.25,0,1));float x=float(s.x),y=float(s.y),w=float(s.w),h=float(s.h);
  if(h<12){}else if(model.eyeVisible()&&a>0){float centers[2]={rtl?96.f:20.f,rtl?118.f:42.f};
   for(int i=0;i<2;i++){float cx=x+centers[i]+float(4*model.gx),cy=y+18+float(3*model.gy-.5*model.squint);
    bool farSide=(model.gx>0&&i==0)||(model.gx<0&&i==1);float ew=float(13*(farSide?1-.18*std::abs(model.gx):1)*(1+.1*model.squint)*model.blink),eh=float(26*(1-.12*std::abs(model.gy))*(1-.4*model.squint)*(1-.1*model.lid/.54));
    dc->PushAxisAlignedClip(D2D1::RectF(cx-15,y+3+float(model.lid*30),cx+15,y+33),D2D1_ANTIALIAS_MODE_PER_PRIMITIVE);
    dc->SetTransform(D2D1::Matrix3x2F::Rotation(-11,D2D1::Point2F(cx,cy))*scale);
    brush->SetColor(light?D2D1::ColorF(12/255.f,12/255.f,18/255.f,a):D2D1::ColorF(247/255.f,248/255.f,252/255.f,a));
    dc->FillRoundedRectangle(D2D1::RoundedRect(D2D1::RectF(cx-ew/2,cy-eh/2,cx+ew/2,cy+eh/2),ew/2,ew/2),brush.Get());dc->SetTransform(scale);dc->PopAxisAlignedClip();
   }
   label(clock,15,D2D1::RectF(x+(rtl?8:68),y,x+(rtl?70:130),y+36),false,a,light);
  }else{brush->SetColor(D2D1::ColorF(.33f,.8f,.5f,a));dc->FillEllipse(D2D1::Ellipse(D2D1::Point2F(x+(rtl?120:18),y+18),3,3),brush.Get());label(clock,15,D2D1::RectF(x+25,y,x+w-10,y+h),false,a,light);}
  float content=float(motion::clamp((model.body.x-.3)/.5,0,1));label(clock,42,D2D1::RectF(x+24,y+22,x+w-24,y+85),false,content,light);label(date,16,D2D1::RectF(x+24,y+90,x+w-24,y+125),rtl,content*.75f,light);
  if(f.flags&64)label(rtl?L"جارٍ التحميل…":L"Loading…",12,D2D1::RectF(x+24,y+140,x+w-24,y+162),rtl,content*.65f,light);
  dc->PopLayer();if(f.flags&32)dc->PopAxisAlignedClip();hr=dc->EndDraw();if(FAILED(hr))return hr;if(file&&*file){hr=capture(file);if(FAILED(hr))return hr;}
  if(!(f.flags&32)){auto sink=new OutlineSink();path->Simplify(D2D1_GEOMETRY_SIMPLIFICATION_OPTION_LINES,&scale,.2f,sink);
  if(sink->points.size()>=3){HRGN region=CreatePolygonRgn(sink->points.data(),int(sink->points.size()),WINDING);if(region&&!SetWindowRgn(window,region,FALSE))DeleteObject(region);}sink->Release();}
  opacity->SetOpacity(f.opacity);if(f.flags&32){RECT rect={LONG(std::floor(dirty.left*f.scale)),LONG(std::floor(dirty.top*f.scale)),LONG(std::ceil(dirty.right*f.scale)),LONG(std::ceil(dirty.bottom*f.scale))};DXGI_PRESENT_PARAMETERS p={};p.DirtyRectsCount=1;p.pDirtyRects=&rect;hr=swap->Present1(0,0,&p);}else hr=swap->Present(0,0);if(FAILED(hr))return hr;return composition->Commit();
 }
};
extern "C" __declspec(dllexport) HRESULT __cdecl MotionCreate(HWND hwnd,void**out){if(!out)return E_POINTER;*out=nullptr;auto r=new Renderer();HRESULT hr=r->initialize(hwnd);if(FAILED(hr)){delete r;return hr;}*out=r;return S_OK;}
extern "C" __declspec(dllexport) void __cdecl MotionDestroy(void*p){delete static_cast<Renderer*>(p);}
extern "C" __declspec(dllexport) void __cdecl MotionStep(void*p,float dt,int flags,float dx,float dy,int pointer,int target,Snapshot*out){auto&r=*static_cast<Renderer*>(p);auto&m=r.model;m.eyes=(flags&1)!=0;m.eco=(flags&2)!=0;m.mode=(flags&8)?2:(flags&4)?1:0;m.fullscreen=(flags&16)!=0;m.compact=(flags&32)!=0;if(pointer>=0)m.pointer(dx,dy,pointer!=0,pointer==2);m.nextBlink=1e30;m.target(target!=0);m.step(dt);*out={float(m.body.x),float(m.drop.x),float(m.gx),float(m.gy),float(m.lid),float(m.squint),float(m.blink),m.eyeVisible()?1:0,m.moving()?1:0};}
extern "C" __declspec(dllexport) HRESULT __cdecl MotionDraw(void*p,const Frame*f,const wchar_t*time,const wchar_t*date,const wchar_t*file){return static_cast<Renderer*>(p)->draw(*f,time,date,file);}
extern "C" __declspec(dllexport) void __cdecl MotionApproach(void*p,float value){auto&m=static_cast<Renderer*>(p)->model;m.anticipation=motion::clamp(value,0,.1);if(!m.opening)m.drop.target=m.anticipation;}
extern "C" __declspec(dllexport) void __cdecl MotionPose(void*p,const Snapshot*s){auto&m=static_cast<Renderer*>(p)->model;m.body.x=s->body;m.drop.x=s->drop;m.body.v=m.drop.v=0;m.body.target=s->body;m.drop.target=s->drop;m.gx=s->gx;m.gy=s->gy;m.lid=s->lid;m.squint=s->squint;m.blink=s->blink;m.opening=s->body>.05;m.eyes=s->visible!=0;m.mode=0;m.eco=false;m.fullscreen=false;m.compact=false;}
extern "C" __declspec(dllexport) HRESULT __cdecl MotionFade(void*p){auto&r=*static_cast<Renderer*>(p);ComPtr<IDCompositionAnimation> a;HRESULT hr=r.composition->CreateAnimation(&a);if(FAILED(hr))return hr;a->AddCubic(0,1,-1.f/.12f,0,0);a->End(.12,0);hr=r.opacity->SetOpacity(a.Get());if(FAILED(hr))return hr;return r.composition->Commit();}
extern "C" __declspec(dllexport) void __cdecl MotionBlink(void*p){auto&m=static_cast<Renderer*>(p)->model;m.blinkStart=m.age;}
extern "C" __declspec(dllexport) void __cdecl MotionAdapter(void*p,wchar_t*name,int capacity){auto&r=*static_cast<Renderer*>(p);ComPtr<IDXGIDevice> d;r.gpu.As(&d);ComPtr<IDXGIAdapter> adapter;d->GetAdapter(&adapter);DXGI_ADAPTER_DESC desc={};adapter->GetDesc(&desc);wcsncpy_s(name,capacity,desc.Description,_TRUNCATE);}
extern "C" __declspec(dllexport) HRESULT __cdecl MotionWait(){return DwmFlush();}
