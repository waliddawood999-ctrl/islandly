#define NOMINMAX
#define UNICODE
#define _UNICODE
#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <dxgi1_3.h>
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
#ifndef CREATE_WAITABLE_TIMER_HIGH_RESOLUTION
#define CREATE_WAITABLE_TIMER_HIGH_RESOLUTION 0x00000002
#endif
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
// Frame-latency waitable object of the composition swap chain (one renderer per process): the single clock of a burst. presentedEvent is set after every successful Present so the burst thread waits for the frame it just asked the UI thread for.
static HANDLE latencyWait=nullptr;static HANDLE presentedEvent=CreateEventW(nullptr,FALSE,FALSE,nullptr);
struct Renderer {
 HWND window;motion::Model model;
 ComPtr<ID3D11Device> gpu;ComPtr<ID3D11DeviceContext> gpuContext;ComPtr<IDXGISwapChain1> swap;
 ComPtr<ID2D1Factory1> factory;ComPtr<ID2D1Device> device;ComPtr<ID2D1DeviceContext> dc;
 ComPtr<IDCompositionEffectGroup> opacity;ComPtr<IDCompositionDevice> composition;ComPtr<IDCompositionTarget> target;ComPtr<IDCompositionVisual> visual;
 ComPtr<IDCompositionSurface> eyeSurface;ComPtr<IDCompositionVisual> slots[2],eyes[2];ComPtr<IDCompositionScaleTransform> eyeScale[2];ComPtr<IDCompositionRotateTransform> eyeRotate[2];ComPtr<IDCompositionTransform> eyeTransform[2];ComPtr<IDCompositionRectangleClip> eyeClip[2];ComPtr<IDCompositionEffectGroup> eyeOpacity[2];
 float eyeDpi=0,baseEyeScale[2]={1,1};bool eyeLight=false,gpuOnlyBlink=false;ULONGLONG gpuBlinkAt=0;double gpuBlinkDuration=0;
 ComPtr<IDWriteFactory> text;ComPtr<ID2D1SolidColorBrush> brush;UINT width=0,height=0;bool latencyFlag=false;
 ~Renderer(){if(latencyWait){CloseHandle(latencyWait);latencyWait=nullptr;}}
 ComPtr<ID2D1Layer> maskLayer; // created once: allocating a layer every frame cost GPU/WARP memory churn
 struct TextFormat{int key;ComPtr<IDWriteTextFormat> format;};std::vector<TextFormat> formats; // created once per (size, direction)

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
  hr=dc->CreateSolidColorBrush(D2D1::ColorF(1,1,1,1),&brush);if(FAILED(hr))return hr;dc->CreateLayer(&maskLayer);for(float size:{12.f,15.f,16.f,42.f}){textFormat(size,false);textFormat(size,true);} /* warm the first paint: layer and DirectWrite formats exist before the first frame */ return S_OK;
 }
 HRESULT resize(UINT w,UINT h){if(width==w&&height==h)return S_OK;dc->SetTarget(nullptr);HRESULT hr;
  if(swap)hr=swap->ResizeBuffers(2,w,h,DXGI_FORMAT_B8G8R8A8_UNORM,latencyFlag?UINT(DXGI_SWAP_CHAIN_FLAG_FRAME_LATENCY_WAITABLE_OBJECT):0u);
  else {ComPtr<IDXGIDevice> dxgi;gpu.As(&dxgi);ComPtr<IDXGIAdapter> adapter;dxgi->GetAdapter(&adapter);ComPtr<IDXGIFactory2> f;adapter->GetParent(IID_PPV_ARGS(&f));
   DXGI_SWAP_CHAIN_DESC1 desc={};desc.Width=w;desc.Height=h;desc.Format=DXGI_FORMAT_B8G8R8A8_UNORM;desc.SampleDesc.Count=1;desc.BufferUsage=DXGI_USAGE_RENDER_TARGET_OUTPUT;desc.BufferCount=2;desc.SwapEffect=DXGI_SWAP_EFFECT_FLIP_SEQUENTIAL;desc.AlphaMode=DXGI_ALPHA_MODE_PREMULTIPLIED;
   desc.Flags=DXGI_SWAP_CHAIN_FLAG_FRAME_LATENCY_WAITABLE_OBJECT;latencyFlag=true;
   hr=f->CreateSwapChainForComposition(gpu.Get(),&desc,nullptr,&swap);
   if(FAILED(hr)){desc.Flags=0;latencyFlag=false;hr=f->CreateSwapChainForComposition(gpu.Get(),&desc,nullptr,&swap);} /* no waitable object on this system: the timer/DwmFlush pacing stays */
   if(SUCCEEDED(hr)&&latencyFlag){ComPtr<IDXGISwapChain2> swap2;if(SUCCEEDED(swap.As(&swap2))&&SUCCEEDED(swap2->SetMaximumFrameLatency(1))){HANDLE h=swap2->GetFrameLatencyWaitableObject();if(h){if(latencyWait)CloseHandle(latencyWait);latencyWait=h;}}}
   if(SUCCEEDED(hr))hr=visual->SetContent(swap.Get());}
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
 IDWriteTextFormat* textFormat(float size,bool rtl){int key=int(size*10)*2+(rtl?1:0);for(auto&e:formats)if(e.key==key)return e.format.Get();ComPtr<IDWriteTextFormat> format;
  if(FAILED(text->CreateTextFormat(L"Segoe UI",nullptr,DWRITE_FONT_WEIGHT_NORMAL,DWRITE_FONT_STYLE_NORMAL,DWRITE_FONT_STRETCH_NORMAL,size,L"ar-SA",&format)))return nullptr;
  format->SetReadingDirection(rtl?DWRITE_READING_DIRECTION_RIGHT_TO_LEFT:DWRITE_READING_DIRECTION_LEFT_TO_RIGHT);format->SetTextAlignment(DWRITE_TEXT_ALIGNMENT_CENTER);format->SetParagraphAlignment(DWRITE_PARAGRAPH_ALIGNMENT_CENTER);format->SetWordWrapping(DWRITE_WORD_WRAPPING_NO_WRAP);
  formats.push_back({key,format});return formats.back().format.Get();
 }
 void label(const wchar_t*value,float size,D2D1_RECT_F rect,bool rtl,float alpha,bool light){if(!value||!*value||alpha<=0)return;IDWriteTextFormat*format=textFormat(size,rtl);if(!format)return;
  brush->SetColor(light?D2D1::ColorF(12/255.f,12/255.f,18/255.f,alpha):D2D1::ColorF(247/255.f,248/255.f,252/255.f,alpha));
  dc->DrawTextW(value,UINT32(wcslen(value)),format,rect,brush.Get(),D2D1_DRAW_TEXT_OPTIONS_CLIP);
 }
 HRESULT prepareEyes(float dpi,bool light){if(eyeSurface&&dpi==eyeDpi&&light==eyeLight)return S_OK;
  eyeSurface.Reset();HRESULT hr=composition->CreateSurface(UINT(std::ceil(32*dpi)),UINT(std::ceil(40*dpi)),DXGI_FORMAT_B8G8R8A8_UNORM,DXGI_ALPHA_MODE_PREMULTIPLIED,&eyeSurface);if(FAILED(hr))return hr;
  POINT origin={};ComPtr<IDXGISurface> surface;hr=eyeSurface->BeginDraw(nullptr,IID_PPV_ARGS(&surface),&origin);if(FAILED(hr))return hr;
  ComPtr<ID2D1Image> previous;dc->GetTarget(&previous);ComPtr<ID2D1Bitmap1> bitmap;auto props=D2D1::BitmapProperties1(D2D1_BITMAP_OPTIONS_TARGET|D2D1_BITMAP_OPTIONS_CANNOT_DRAW,D2D1::PixelFormat(DXGI_FORMAT_B8G8R8A8_UNORM,D2D1_ALPHA_MODE_PREMULTIPLIED),96,96);
  hr=dc->CreateBitmapFromDxgiSurface(surface.Get(),&props,&bitmap);if(SUCCEEDED(hr)){dc->SetTarget(bitmap.Get());dc->SetTransform(D2D1::Matrix3x2F::Scale(dpi,dpi)*D2D1::Matrix3x2F::Translation(float(origin.x),float(origin.y)));dc->BeginDraw();dc->Clear(D2D1::ColorF(0,0,0,0));brush->SetColor(light?D2D1::ColorF(12/255.f,12/255.f,18/255.f,1):D2D1::ColorF(247/255.f,248/255.f,252/255.f,1));dc->FillRoundedRectangle(D2D1::RoundedRect(D2D1::RectF(9.5f,7,22.5f,33),6.5f,6.5f),brush.Get());hr=dc->EndDraw();dc->SetTarget(previous.Get());}
  HRESULT end=eyeSurface->EndDraw();if(FAILED(hr))return hr;if(FAILED(end))return end;
  for(int i=0;i<2;i++){if(!slots[i]){hr=composition->CreateVisual(&slots[i]);if(FAILED(hr))return hr;hr=composition->CreateVisual(&eyes[i]);if(FAILED(hr))return hr;hr=composition->CreateScaleTransform(&eyeScale[i]);if(FAILED(hr))return hr;hr=composition->CreateRotateTransform(&eyeRotate[i]);if(FAILED(hr))return hr;
    IDCompositionTransform* transforms[]={eyeScale[i].Get(),eyeRotate[i].Get()};hr=composition->CreateTransformGroup(transforms,2,&eyeTransform[i]);if(FAILED(hr))return hr;hr=composition->CreateRectangleClip(&eyeClip[i]);if(FAILED(hr))return hr;hr=composition->CreateEffectGroup(&eyeOpacity[i]);if(FAILED(hr))return hr;
    eyes[i]->SetTransform(eyeTransform[i].Get());slots[i]->SetClip(eyeClip[i].Get());slots[i]->SetEffect(eyeOpacity[i].Get());slots[i]->AddVisual(eyes[i].Get(),TRUE,nullptr);visual->AddVisual(slots[i].Get(),TRUE,nullptr);
   }
   eyes[i]->SetContent(eyeSurface.Get());eyeScale[i]->SetCenterX(16*dpi);eyeScale[i]->SetCenterY(20*dpi);eyeRotate[i]->SetCenterX(16*dpi);eyeRotate[i]->SetCenterY(20*dpi);eyeRotate[i]->SetAngle(-11);
  }
  eyeDpi=dpi;eyeLight=light;return S_OK;
 }
 HRESULT updateEyes(const Frame&f,const motion::Shape&s,bool baked){HRESULT hr=prepareEyes(f.scale,(f.flags&1)!=0);if(FAILED(hr))return hr;bool rtl=(f.flags&2)!=0;float a=baked?0:float(motion::clamp(1-model.body.x/.25,0,1));if(!model.eyeVisible())a=0;
  for(int i=0;i<2;i++){float slot=rtl?(i==0?96.f:118.f):(i==0?20.f:42.f);float cx=float(s.x)+slot+float(4*model.gx),cy=float(s.y)+18+float(3*model.gy-.5*model.squint);bool farSide=(model.gx>0&&i==0)||(model.gx<0&&i==1);
   baseEyeScale[i]=float((farSide?1-.18*std::abs(model.gx):1)*(1+.1*model.squint));eyeScale[i]->SetScaleX(baseEyeScale[i]*float(model.blink));eyeScale[i]->SetScaleY(float((1-.12*std::abs(model.gy))*(1-.4*model.squint)*(1-.1*model.lid/.54)));
   eyes[i]->SetOffsetX((cx-16)*f.scale);eyes[i]->SetOffsetY((cy-20)*f.scale);eyeClip[i]->SetLeft((cx-15)*f.scale);eyeClip[i]->SetRight((cx+15)*f.scale);eyeClip[i]->SetTop((float(s.y)+3+float(model.lid*30))*f.scale);eyeClip[i]->SetBottom((float(s.y)+33)*f.scale);eyeOpacity[i]->SetOpacity(a);
  }return S_OK;
 }
 HRESULT blink(bool animateModel){if(!eyeSurface)return S_FALSE;double duration=model.nearby?.28:.38;gpuBlinkAt=GetTickCount64();gpuBlinkDuration=duration;gpuOnlyBlink=!animateModel;if(animateModel)model.blinkStart=model.age;
  for(int i=0;i<2;i++){ComPtr<IDCompositionAnimation> a;HRESULT hr=composition->CreateAnimation(&a);if(FAILED(hr))return hr;float base=baseEyeScale[i],close=float(.4*duration),open=float(.52*duration);a->AddCubic(0,base,0,-.9f*base/(close*close),0);a->AddCubic(.4*duration,.1f*base,0,0,0);a->AddCubic(.48*duration,.1f*base,1.8f*base/open,-.9f*base/(open*open),0);a->End(duration,base);eyeScale[i]->SetScaleX(a.Get());}return composition->Commit();
 }
 // Alpha audit (diagnostics): after each frame, every pixel of the composition surface outside the island's bounding box must be fully transparent. The count and first position are kept for the host status.
 bool auditAlpha=false;unsigned leakCount=0;int leakX=-1,leakY=-1;
 HRESULT auditLeak(const motion::Shape&s,const Frame&f){ComPtr<ID3D11Texture2D> back;HRESULT hr=swap->GetBuffer(0,IID_PPV_ARGS(&back));if(FAILED(hr))return hr;
  D3D11_TEXTURE2D_DESC desc;back->GetDesc(&desc);desc.BindFlags=0;desc.CPUAccessFlags=D3D11_CPU_ACCESS_READ;desc.Usage=D3D11_USAGE_STAGING;desc.MiscFlags=0;
  ComPtr<ID3D11Texture2D> staging;hr=gpu->CreateTexture2D(&desc,nullptr,&staging);if(FAILED(hr))return hr;gpuContext->CopyResource(staging.Get(),back.Get());
  D3D11_MAPPED_SUBRESOURCE pixels;hr=gpuContext->Map(staging.Get(),0,D3D11_MAP_READ,0,&pixels);if(FAILED(hr))return hr;
  float k=f.scale;int x0=int(std::floor((s.x-6)*k)),x1=int(std::ceil((s.x+s.w+6)*k)),y0=int(std::floor((s.y-6)*k)),y1=int(std::ceil((s.y+s.h+s.bulge+6)*k));
  for(UINT y=0;y<desc.Height;y++){const BYTE*row=static_cast<const BYTE*>(pixels.pData)+size_t(y)*pixels.RowPitch;for(UINT x=0;x<desc.Width;x++){
    if(int(x)>=x0&&int(x)<=x1&&int(y)>=y0&&int(y)<=y1)continue;if(row[x*4+3]!=0){if(leakCount==0){leakX=int(x);leakY=int(y);}leakCount++;}}}
  gpuContext->Unmap(staging.Get(),0);return S_OK;}
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
  if((f.flags&32)&&eyeSurface){hr=updateEyes(f,s,false);if(FAILED(hr))return hr;return composition->Commit();}
  auto path=outline(s);
  auto scale=D2D1::Matrix3x2F::Scale(f.scale,f.scale);dc->SetTransform(scale);dc->BeginDraw();
  D2D1_RECT_F dirty=D2D1::RectF(float(s.x)+(rtl?78.f:2.f),float(s.y),float(s.x)+(rtl?136.f:60.f),float(s.y)+36);
  if(f.flags&128)dirty=D2D1::RectF(std::max(0.f,float(s.x)-2),std::max(0.f,float(s.y)-2),float(s.x+s.w)+2,float(s.y+s.h)+2); /* label/date-only redraw of the collapsed pill: the clip is the pill plus 2 px, the layer mask still keeps everything inside the outline, and the window region is untouched */
  const bool clipped=(f.flags&(32|128))!=0;
  if(clipped)dc->PushAxisAlignedClip(dirty,D2D1_ANTIALIAS_MODE_ALIASED);
  dc->Clear(D2D1::ColorF(0,0,0,0));
  brush->SetColor(light?D2D1::ColorF(.94f,.94f,.96f,acrylic?.46f:.94f):D2D1::ColorF(12/255.f,12/255.f,15/255.f,acrylic?.46f:.9f));dc->FillGeometry(path.Get(),brush.Get());
  if(!maskLayer)dc->CreateLayer(&maskLayer);dc->PushLayer(D2D1::LayerParameters(D2D1::InfiniteRect(),path.Get()),maskLayer.Get());
  if(floating){brush->SetColor(D2D1::ColorF(1,1,1,.06f));dc->DrawGeometry(path.Get(),brush.Get(),4.f);}
  /* Edge: a light island on a light desktop needs a visible contour (grey 241 on 237 was invisible); the stroke is centred on the outline and the layer mask keeps the inner 1 px. */ if(light){brush->SetColor(D2D1::ColorF(0,0,0,.30f));dc->DrawGeometry(path.Get(),brush.Get(),2.f);}else{brush->SetColor(D2D1::ColorF(1,1,1,.12f));dc->DrawGeometry(path.Get(),brush.Get(),1.f);}
  float a=float(motion::clamp(1-model.body.x/.25,0,1));float x=float(s.x),y=float(s.y),w=float(s.w),h=float(s.h);
  if(h<12){}else if(model.eyeVisible()&&a>0){float centers[2]={rtl?96.f:20.f,rtl?118.f:42.f};
   if(file&&*file)for(int i=0;i<2;i++){float cx=x+centers[i]+float(4*model.gx),cy=y+18+float(3*model.gy-.5*model.squint);
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
  dc->PopLayer();if(clipped)dc->PopAxisAlignedClip();hr=dc->EndDraw();if(FAILED(hr))return hr;if(file&&*file){hr=capture(file);if(FAILED(hr))return hr;}if(auditAlpha&&!clipped){hr=auditLeak(s,f);if(FAILED(hr))return hr;}
  if(!clipped){auto sink=new OutlineSink();path->Simplify(D2D1_GEOMETRY_SIMPLIFICATION_OPTION_LINES,&scale,.75f,sink); /* window-region polygon: 0.75 px flattening tolerance keeps it to a few dozen points; SetWindowRgn per frame was the heaviest call */
  if(sink->points.size()>=3){HRGN region=CreatePolygonRgn(sink->points.data(),int(sink->points.size()),WINDING);if(region&&!SetWindowRgn(window,region,FALSE))DeleteObject(region);}sink->Release();}
  hr=updateEyes(f,s,file&&*file);if(FAILED(hr))return hr;opacity->SetOpacity(f.opacity);if(clipped){RECT rect={std::max(0L,LONG(std::floor(dirty.left*f.scale))),std::max(0L,LONG(std::floor(dirty.top*f.scale))),std::min(LONG(width),LONG(std::ceil(dirty.right*f.scale))),std::min(LONG(height),LONG(std::ceil(dirty.bottom*f.scale)))}; /* a dirty rectangle outside the back buffer is DXGI_ERROR_INVALID_CALL (top=0 pill: y-2 < 0) */
   if(rect.right>rect.left&&rect.bottom>rect.top){DXGI_PRESENT_PARAMETERS p={};p.DirtyRectsCount=1;p.pDirtyRects=&rect;hr=swap->Present1(0,0,&p);}else hr=DXGI_ERROR_INVALID_CALL;
   if(hr==DXGI_ERROR_INVALID_CALL)hr=swap->Present(0,0);}else hr=swap->Present(0,0);if(FAILED(hr))return hr;if(presentedEvent)SetEvent(presentedEvent);return composition->Commit();
 }
};
extern "C" __declspec(dllexport) HRESULT __cdecl MotionCreate(HWND hwnd,void**out){if(!out)return E_POINTER;*out=nullptr;auto r=new Renderer();HRESULT hr=r->initialize(hwnd);if(FAILED(hr)){delete r;return hr;}*out=r;return S_OK;}
extern "C" __declspec(dllexport) void __cdecl MotionDestroy(void*p){delete static_cast<Renderer*>(p);}
extern "C" __declspec(dllexport) void __cdecl MotionStep(void*p,float dt,int flags,float dx,float dy,int pointer,int target,Snapshot*out){auto&r=*static_cast<Renderer*>(p);auto&m=r.model;m.eyes=(flags&1)!=0;m.eco=(flags&2)!=0;m.mode=(flags&8)?2:(flags&4)?1:0;m.fullscreen=(flags&16)!=0;m.compact=(flags&32)!=0;if(pointer>=0)m.pointer(dx,dy,pointer!=0,pointer==2);if(r.gpuOnlyBlink){double elapsed=(GetTickCount64()-r.gpuBlinkAt)/1000.;if(elapsed<r.gpuBlinkDuration)m.blinkStart=m.age-elapsed;else m.blinkStart=-1;r.gpuOnlyBlink=false;}m.nextBlink=1e30;m.target(target!=0);m.step(dt);*out={float(m.body.x),float(m.drop.x),float(m.gx),float(m.gy),float(m.lid),float(m.squint),float(m.blink),m.eyeVisible()?1:0,m.moving()?1:0};}
extern "C" __declspec(dllexport) void __cdecl MotionAudit(void*p,int on){auto&r=*static_cast<Renderer*>(p);r.auditAlpha=on!=0;if(on){r.leakCount=0;r.leakX=-1;r.leakY=-1;}}
extern "C" __declspec(dllexport) void __cdecl MotionLeak(void*p,unsigned*count,int*x,int*y){auto&r=*static_cast<Renderer*>(p);*count=r.leakCount;*x=r.leakX;*y=r.leakY;}
extern "C" __declspec(dllexport) HRESULT __cdecl MotionDraw(void*p,const Frame*f,const wchar_t*time,const wchar_t*date,const wchar_t*file){return static_cast<Renderer*>(p)->draw(*f,time,date,file);}
extern "C" __declspec(dllexport) void __cdecl MotionApproach(void*p,float value){auto&m=static_cast<Renderer*>(p)->model;m.anticipation=motion::clamp(value,0,.1);if(!m.opening)m.drop.target=m.anticipation;}
extern "C" __declspec(dllexport) void __cdecl MotionPose(void*p,const Snapshot*s){auto&m=static_cast<Renderer*>(p)->model;m.body.x=s->body;m.drop.x=s->drop;m.body.v=m.drop.v=0;m.body.target=s->body;m.drop.target=s->drop;m.gx=s->gx;m.gy=s->gy;m.lid=s->lid;m.squint=s->squint;m.blink=s->blink;m.opening=s->body>.05;m.eyes=s->visible!=0;m.mode=0;m.eco=false;m.fullscreen=false;m.compact=false;}
extern "C" __declspec(dllexport) HRESULT __cdecl MotionFade(void*p){auto&r=*static_cast<Renderer*>(p);ComPtr<IDCompositionAnimation> a;HRESULT hr=r.composition->CreateAnimation(&a);if(FAILED(hr))return hr;a->AddCubic(0,1,-1.f/.12f,0,0);a->End(.12,0);hr=r.opacity->SetOpacity(a.Get());if(FAILED(hr))return hr;return r.composition->Commit();}
extern "C" __declspec(dllexport) HRESULT __cdecl MotionBlink(void*p,int animateModel){return static_cast<Renderer*>(p)->blink(animateModel!=0);}
extern "C" __declspec(dllexport) void __cdecl MotionAdapter(void*p,wchar_t*name,int capacity){auto&r=*static_cast<Renderer*>(p);ComPtr<IDXGIDevice> d;r.gpu.As(&d);ComPtr<IDXGIAdapter> adapter;d->GetAdapter(&adapter);DXGI_ADAPTER_DESC desc={};adapter->GetDesc(&desc);wcsncpy_s(name,capacity,desc.Description,_TRUNCATE);}
// Frame pacing for the burst loop. Primary: the compositor's own vblank (DwmFlush blocks until the next one).
// Where that does not block (virtual/headless displays, CI runners: it returns at once or fails) the loop is paced by an
// absolute-schedule high-resolution waitable timer at 16.0 ms (never later than a 60 Hz display period, drift-free),
// not by Sleep (whose 15.6 ms granularity gave 31 ms frames). The vblank is re-probed only by MotionBurst() at the start of a burst, never in the middle of one (a mid-burst probe returned a frame at once and re-anchored the schedule).
static bool burstFirst=true,latencyBroken=false;static int instantLatency=0;
static HANDLE paceTimer=nullptr;static LARGE_INTEGER paceFrequency={};static LONGLONG paceNext=0;static bool paced=false;static int paceProbe=0,instantWaits=0;
// Fallback pace where the compositor gives no vblank (headless/virtual displays, CI): 15 ms keeps a 60 Hz budget of 16.667 ms with 1.6 ms of scheduling slack; a 16.0 ms target left 0.67 ms and p95 sat on the line. Real displays pace on DwmFlush instead.
static const double kFallbackPaceMs=16.0;
static HRESULT paceWait(double periodMs){
 if(!paceTimer){paceTimer=CreateWaitableTimerExW(nullptr,nullptr,CREATE_WAITABLE_TIMER_HIGH_RESOLUTION,TIMER_ALL_ACCESS);if(!paceTimer)paceTimer=CreateWaitableTimerExW(nullptr,nullptr,0,TIMER_ALL_ACCESS);QueryPerformanceFrequency(&paceFrequency);}
 LARGE_INTEGER now;QueryPerformanceCounter(&now);const LONGLONG period=LONGLONG(paceFrequency.QuadPart*periodMs/1000.0);
 if(paceNext==0||now.QuadPart-paceNext>4*period)paceNext=now.QuadPart;paceNext+=period;
 if(paceNext<=now.QuadPart){paceNext=now.QuadPart;return S_OK;} // already late: run the frame now and re-anchor
 if(!paceTimer){WaitForSingleObject(GetCurrentThread(),DWORD(periodMs));return S_OK;}
 LARGE_INTEGER due;due.QuadPart=-LONGLONG(double(paceNext-now.QuadPart)*10000000.0/double(paceFrequency.QuadPart));
 if(!SetWaitableTimer(paceTimer,&due,0,nullptr,nullptr,FALSE))return S_OK;WaitForSingleObject(paceTimer,INFINITE);return S_OK;
}
extern "C" __declspec(dllexport) void __cdecl MotionBurst(){
 // Burst start (worker thread, before the first frame): only a timer-paced loop needs a re-probe, and there DwmFlush is the cheap case. A display that has gained a working vblank returns to it.
 paceNext=0;instantWaits=0;burstFirst=true;if(presentedEvent)ResetEvent(presentedEvent);
 if(!paced)return;
 for(int i=0;i<2;i++){LARGE_INTEGER a,b,f;QueryPerformanceFrequency(&f);QueryPerformanceCounter(&a);HRESULT hr=DwmFlush();QueryPerformanceCounter(&b);
  if(!(SUCCEEDED(hr)&&double(b.QuadPart-a.QuadPart)*1000.0/double(f.QuadPart)>=1.0))return;}
 paced=false;
}
extern "C" __declspec(dllexport) HRESULT __cdecl MotionWait(){
 // One clock per burst: the swap chain's frame-latency waitable object (maximum latency 1) signals when the compositor has released the previous frame, so Present never blocks. The burst thread first waits until the UI thread has presented the tick it was just handed, then for the compositor. If the object is missing, times out, or returns at once six times in a row (no compositor pacing: headless), the DwmFlush/timer path below takes over.
 if(latencyWait&&!latencyBroken){
  if(!burstFirst&&presentedEvent&&WaitForSingleObject(presentedEvent,40)!=WAIT_OBJECT_0)return paceWait(kFallbackPaceMs);
  burstFirst=false;
  LARGE_INTEGER a,b,f;QueryPerformanceFrequency(&f);QueryPerformanceCounter(&a);DWORD r=WaitForSingleObject(latencyWait,40);QueryPerformanceCounter(&b);
  if(r!=WAIT_OBJECT_0)return paceWait(kFallbackPaceMs);
  if(double(b.QuadPart-a.QuadPart)*1000.0/double(f.QuadPart)<0.5){if(++instantLatency>=6)latencyBroken=true;}else instantLatency=0;
  return S_OK;
 }
 if(paced)return paceWait(kFallbackPaceMs);
 LARGE_INTEGER a,b,f;QueryPerformanceFrequency(&f);QueryPerformanceCounter(&a);HRESULT hr=DwmFlush();QueryPerformanceCounter(&b);
 double ms=double(b.QuadPart-a.QuadPart)*1000.0/double(f.QuadPart);
 if(SUCCEEDED(hr)&&ms>=1.0){instantWaits=0;paceNext=0;return S_OK;}
 if(++instantWaits>=2){paced=true;return paceWait(kFallbackPaceMs);}
 return S_OK;
}
