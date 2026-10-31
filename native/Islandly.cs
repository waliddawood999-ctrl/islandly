// Native Win32/WinForms lifetime owner. No WebView, Chromium, Node, or Electron at idle.
using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.IO.Pipes;
using System.Collections;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Web.Script.Serialization;
using System.Windows.Forms;

static class Native {
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int left, top, right, bottom; }
    [StructLayout(LayoutKind.Sequential)] public struct APPBARDATA { public int cbSize; public IntPtr hWnd; public uint callback, edge; public RECT rect; public IntPtr param; }
    [StructLayout(LayoutKind.Sequential)] public struct IOCOUNTERS { public ulong a,b,c,d,e,f; }
    [StructLayout(LayoutKind.Sequential)] public struct BASICLIMIT { public long a,b; public uint flags; public UIntPtr min,max; public uint active; public UIntPtr affinity; public uint priority,scheduling; }
    [StructLayout(LayoutKind.Sequential)] public struct EXTENDEDLIMIT { public BASICLIMIT basic; public IOCOUNTERS io; public UIntPtr a,b,c,d; }
    [DllImport("shell32.dll")] public static extern UIntPtr SHAppBarMessage(uint msg, ref APPBARDATA data);
    [DllImport("user32.dll",SetLastError=true)] public static extern bool RegisterHotKey(IntPtr h, int id, uint mods, uint key);
    [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr h, int id);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool AddClipboardFormatListener(IntPtr h);
    [DllImport("user32.dll")] public static extern bool RemoveClipboardFormatListener(IntPtr h);
    [StructLayout(LayoutKind.Sequential)] public struct LASTINPUT { public uint size,time; }
    [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUT input);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window,StringBuilder title,int max);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
    [DllImport("advapi32.dll")] public static extern int RegNotifyChangeKeyValue(IntPtr key,bool subtree,uint filter,IntPtr ev,bool async);

    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT rect);
    [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int size; public RECT monitor, work; public uint flags; }
    [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
    [DllImport("user32.dll")] public static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFO info);
    [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int attribute, out RECT rect, int size);
    [DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int state);
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr window);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern uint RegisterWindowMessage(string name);
    [StructLayout(LayoutKind.Sequential, Pack=8)] public struct STARTUPINFO { public uint cb; public IntPtr reserved, desktop, title; public int x,y,w,h,xChars,yChars,fill,flags; public short show,reservedBytes; public IntPtr reservedPtr,input,output,error; }
    [StructLayout(LayoutKind.Sequential)] public struct PROCESSINFO { public IntPtr process,thread; public int pid,tid; }
    [DllImport("kernel32.dll", EntryPoint="CreateProcessW", ExactSpelling=true, CharSet=CharSet.Unicode, SetLastError=true)] [return: MarshalAs(UnmanagedType.Bool)] public static extern bool CreateProcess(string app, StringBuilder command, IntPtr pa, IntPtr ta, [MarshalAs(UnmanagedType.Bool)] bool inherit, uint flags, IntPtr environment, string directory, ref STARTUPINFO startup, out PROCESSINFO info);
    [DllImport("kernel32.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.Bool)] public static extern bool SetThreadErrorMode(uint mode,out uint previous);
    [DllImport("kernel32.dll",SetLastError=true)] public static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode,SetLastError=true)] public static extern IntPtr CreateJobObject(IntPtr attrs, string name);
    [DllImport("kernel32.dll",SetLastError=true)] public static extern bool SetInformationJobObject(IntPtr h, int type, ref EXTENDEDLIMIT data, int len);
    [DllImport("kernel32.dll",SetLastError=true)] public static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll",SetLastError=true)] public static extern bool TerminateJobObject(IntPtr job, uint code);
    [DllImport("kernel32.dll")] public static extern bool QueryInformationJobObject(IntPtr h, int type, IntPtr data, uint size, out uint returned);
    [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
}

sealed class IslandHost : Form {
    readonly string root, electron, profile, probe;
    readonly bool packaged,quietProbe;
    readonly int probeLaunchDelay;
    readonly JavaScriptSerializer json = new JavaScriptSerializer();
    readonly System.Windows.Forms.Timer ticker = new System.Windows.Forms.Timer();
    readonly System.Windows.Forms.Timer hoverDwell = new System.Windows.Forms.Timer();
    readonly Stopwatch clock = Stopwatch.StartNew();
    static readonly Dictionary<string,string> FriendlyNames = new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase) {
        {"chrome","Chrome"},{"msedge","Edge"},{"firefox","Firefox"},{"code","VS Code"},{"explorer","File Explorer"},
        {"winword","Word"},{"excel","Excel"},{"powerpnt","PowerPoint"},{"outlook","Outlook"},{"olk","Outlook"},
        {"teams","Teams"},{"ms-teams","Teams"},{"spotify","Spotify"},{"discord","Discord"},{"whatsapp","WhatsApp"},
        {"telegram","Telegram"},{"slack","Slack"},{"notepad","Notepad"},{"windowsterminal","Terminal"},{"zoom","Zoom"}
    };
    readonly Queue<double> latencies = new Queue<double>();
    Dictionary<string,object> settings = new Dictionary<string,object>();
    Dictionary<string,object> state = new Dictionary<string,object>();
    Process child;
    StreamWriter childInput;
    NamedPipeServerStream sessionPipe;
    readonly System.Windows.Forms.Timer launchRetry = new System.Windows.Forms.Timer();
    bool launching, policyBlockedHover, loadingPainted, loadingShown;
    long loadingShownAt;
    readonly System.Windows.Forms.Timer loadingGate = new System.Windows.Forms.Timer();
    string retryCommand="";
    long nextLaunchAt, lastFailureNotice;
    IntPtr job;
    NotifyIcon tray;
    bool ready, bar, closing, hidden, measuring, hoverArmed;
    long launchedAt, requestAt, readyAt, shutdownAt, stateWrittenAt;
    string lastCommand = "";
    string modeOverride;
    Native.APPBARDATA abd;
    DateTime settingsStamp;
    int launchCount;
    bool hasLaunchedSuccessfully,sessionHydrated,panelGeometryReceived,panelPresentRequested;
    string islandHotkey="Ctrl+Alt+I";
    readonly Dictionary<int,double> cpuTimes = new Dictionary<int,double>();
    long cpuSampleAt;
    uint taskbarCreated;
    bool barBlocked;
    long lastBackground, compactAt, activityAt; FileSystemWatcher settingsWatch, commandWatch;
    void Wake() { activityAt = clock.ElapsedMilliseconds; if (IsHandleCreated && !closing) try { BeginInvoke((Action)delegate { if (!closing) Tick(null, EventArgs.Empty); }); } catch { } }
    int breakSeconds;
    readonly List<string> pendingClipboard = new List<string>();
    ConsentWatcher consent;
    string privacyLabel = "";
    bool nativeEco, nativeAcrylic,nativeLight;int clockMinute=-1;
    string appliedMaterial = "";
    Size clippedSize=Size.Empty;
    ForegroundWatcher foregroundWatcher; NativeMotion motion; bool cancelLaunch,hoverLaunch; readonly System.Windows.Forms.Timer leaveGrace=new System.Windows.Forms.Timer();

    public IslandHost(string[] args) {
        packaged = File.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"panels/Islandly.exe"));
        root = Arg(args,"--root", packaged ? Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"panels/resources/app") : Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"../..")));
        root=Path.GetFullPath(root);
        electron = Arg(args,"--electron", packaged ? Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"panels/Islandly.exe") : Path.Combine(root,"node_modules/electron/dist/electron.exe"));
        electron=Path.GetFullPath(electron);
        profile = Arg(args,"--profile", Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"islandly"));
        profile=Path.GetFullPath(profile); NativeLog.Profile=profile;
        probe = Arg(args,"--probe-dir", "");quietProbe=probe!=""&&args.Contains("--quiet-probe");
        modeOverride = Arg(args,"--mode", "");
        if(probe!="") Int32.TryParse(Arg(args,"--launch-delay-ms","0"),out probeLaunchDelay);
        Directory.CreateDirectory(profile);
        if (probe != "") { Directory.CreateDirectory(probe); measuring = !args.Contains("--interactive-probe"); }
        ReadSettings();
        try { state = json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(profile,"native-session.json"))); } catch { }
        object initialBreak; if(state.TryGetValue("breakActive",out initialBreak)) breakSeconds=(int)(Math.Max(0,Convert.ToDouble(initialBreak))*60);
        object pending;
        if(state.TryGetValue("clipboardPending",out pending) && pending is IEnumerable) pendingClipboard.AddRange(((IEnumerable)pending).Cast<object>().Select(x => Convert.ToString(x)).Take(30));
        Text = "Islandly Native"; Name = "IslandlyNative";
        FormBorderStyle = FormBorderStyle.None; ShowInTaskbar = false; TopMost = true;
        BackColor = Color.FromArgb(8,8,10); ForeColor = Color.White;
        DoubleBuffered = true; AutoScaleMode = AutoScaleMode.None;
        var menu = new ContextMenuStrip();
        menu.Items.Add("Expand", null, delegate { OpenPanel("expand"); });
        menu.Items.Add("Settings", null, delegate { OpenPanel("settings"); });
        menu.Items.Add("Command palette", null, delegate { OpenPanel("palette"); });
        menu.Items.Add("Show / hide island", null, delegate { hidden = !hidden; Position(); });
        menu.Items.Add("Open data folder", null, delegate { Process.Start("explorer.exe", profile); });
        menu.Items.Add("Start with Windows", null, delegate { ToggleStartup(); });
        menu.Items.Add("Quit", null, delegate { Close(); });
        ContextMenuStrip = menu;
        tray = new NotifyIcon { Text = "Islandly", Icon = SystemIcons.Application, ContextMenuStrip = menu, Visible = true };
        tray.DoubleClick += delegate { OpenPanel("settings"); };
        MouseEnter += delegate { ArmHover(); };
        MouseMove += delegate { if(motion!=null)motion.PointerEvent(); };
        MouseLeave += delegate { LeaveHover(); };
        MouseClick += delegate(object s, MouseEventArgs e) { if (e.Button == MouseButtons.Left) OpenPanel("expand","click"); };
        leaveGrace.Interval=200; leaveGrace.Tick+=delegate { leaveGrace.Stop(); if(motion!=null&&!motion.ContainsPointer()){motion.LeaveApproach();if(revealed){revealed=false;Position();}if(hoverLaunch&&motion.Opening&&!ready){NativeLog.Write("hover-cancel","pointer outside current card+16 after200ms");cancelLaunch=true;loadingGate.Stop();motion.Open(false);Send("close");RefreshLoading("hover-cancel");Invalidate();}}if(motion!=null&&!motion.Opening)Position(); /* after a hover-cancel Opening is false: this Position() redraws the native frame without the caption in the same tick, not at session end */ };
        loadingGate.Interval=310; loadingGate.Tick+=delegate { loadingGate.Stop(); if(launching&&hoverLaunch&&!cancelLaunch)Position(); }; // a hover launch may show the caption only after 300 ms: wake Position() once then, no polling
        hoverDwell.Interval = 120; hoverDwell.Tick += delegate { hoverDwell.Stop(); if(hoverArmed && !measuring && !Fullscreen()) OpenPanel("expand","hover"); };
        launchRetry.Interval=1500;
        launchRetry.Tick+=delegate { launchRetry.Stop(); string requested=retryCommand; retryCommand=""; if(requested!="") OpenPanel(requested,"retry",true); };
        ticker.Interval = 1000; ticker.Tick += Tick; ticker.Start();
        // File changes wake the host (ReadDirectoryChangesW completes on the thread pool: no polling). With nothing to do the 1 s ticker relaxes to the next minute boundary (see Tick).
        try { settingsWatch = new FileSystemWatcher(profile, "settings.json") { NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName | NotifyFilters.Size, EnableRaisingEvents = true };
            settingsWatch.Changed += delegate { Wake(); }; settingsWatch.Created += delegate { Wake(); }; settingsWatch.Renamed += delegate { Wake(); }; } catch { }
        if (probe != "") try { commandWatch = new FileSystemWatcher(probe, "command.txt") { NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName | NotifyFilters.Size, EnableRaisingEvents = true };
            commandWatch.Changed += delegate { Wake(); }; commandWatch.Created += delegate { Wake(); }; commandWatch.Renamed += delegate { Wake(); }; } catch { }
        FormClosed += delegate { Cleanup(); };
        Microsoft.Win32.SystemEvents.DisplaySettingsChanged += DisplayChanged;
        Microsoft.Win32.SystemEvents.PowerModeChanged += PowerChanged;
        Microsoft.Win32.SystemEvents.UserPreferenceChanged += ThemeChanged;
        ReadTheme();
    }
    static string Arg(string[] args, string key, string fallback) { int i = Array.IndexOf(args,key); return i >= 0 && i+1 < args.Length ? args[i+1] : fallback; }
    protected override bool ShowWithoutActivation { get { return true; } }
    protected override CreateParams CreateParams { get { var p = base.CreateParams; p.ExStyle |= 0x08200080; return p; } }
    string Setting(string key, string fallback) { object v; return settings.TryGetValue(key,out v) ? Convert.ToString(v,System.Globalization.CultureInfo.InvariantCulture) : fallback; }
    // The file watchers read right after the writer touched the file: never hold it against the writer (File.ReadAllText shares read-only and made the next Set-Content fail with a sharing violation).
    static string ReadShared(string path) { using(var stream=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete)) using(var reader=new StreamReader(stream)) return reader.ReadToEnd(); }
    bool ReadSettings() {
        string file = Path.Combine(profile,"settings.json");
        try { var stamp = File.GetLastWriteTimeUtc(file); if (stamp == settingsStamp) return false;
            var next = json.Deserialize<Dictionary<string,object>>(ReadShared(file)); if(next == null) return false; /* the watcher fires while the writer has truncated the file: an empty read deserializes to null and is retried on the next event */ settings = next; settingsStamp = stamp; UpdateEco();return true;
        } catch {return false;}
    }
    protected override void OnHandleCreated(EventArgs e) {
        base.OnHandleCreated(e);
        if(!RegisterShortcut(1,0x4003,0x49,"Ctrl+Alt+I")) {
            islandHotkey="Ctrl+Alt+Shift+I";
            if(!RegisterShortcut(1,0x4007,0x49,islandHotkey)) islandHotkey="unavailable (use click/tray)";
        }
        RegisterShortcut(2,0x4003,0x20,"Ctrl+Alt+Space");
        RegisterShortcut(3,0x4003,0x50,"Ctrl+Alt+P");
        RegisterShortcut(4,0x4003,0x53,"Ctrl+Alt+S");
        taskbarCreated=Native.RegisterWindowMessage("TaskbarCreated");
        RecoverBar();
        Native.AddClipboardFormatListener(Handle);
        motion=new NativeMotion(this,ArmHover,LeaveHover,delegate{OpenPanel("expand","click");},probe!="" && Environment.GetCommandLineArgs().Contains("--motion-metrics"));
        NativeMaterial.Apply(Handle,false,nativeLight); // clear any accent before the first Position(): the motion host never carries one
        motion.FrameChanged+=delegate(double time){if(launching&&!loadingPainted){loadingPainted=true;NativeLog.Write("loading-paint","inputToPaintMs="+(clock.ElapsedMilliseconds-requestAt));}};
        motion.BurstEnded=delegate{ if(deferredPosition){deferredPosition=false;Position();} };
        motion.Reveal=delegate{if(!revealed){revealed=true;Position();}};
        consent = new ConsentWatcher(delegate(string label) { if(!closing) { privacyLabel = label; Position(); } });
        foregroundWatcher=new ForegroundWatcher(this,delegate{ if(motion!=null&&motion.Bursting){deferredPosition=true;return;} Position(); }); // foreground/location events never run Position() in the middle of a liquid burst; it runs when the burst ends
        Position();Status();
    }
    void ArmHover(){hoverArmed=true;leaveGrace.Stop();Position();if(motion!=null)motion.PointerEvent();hoverDwell.Start();}
    void LeaveHover(){hoverArmed=false;hoverDwell.Stop();leaveGrace.Start();}
    bool RegisterShortcut(int id,uint mods,uint key,string name) {
        bool ok=Native.RegisterHotKey(Handle,id,mods,key); int error=ok?0:Marshal.GetLastWin32Error();
        NativeLog.Write("hotkey-register","combo="+name+" success="+ok+" error="+error);
        if(!ok && tray!=null) tray.ShowBalloonTip(5000,"Islandly","اختصار غير متاح / Shortcut unavailable: "+name+". Fallback: Ctrl+Alt+Shift+I or click the island.",ToolTipIcon.Info);
        return ok;
    }
    void UpdateEco() {
        nativeEco = Setting("ecoMode","False") == "True" || Setting("ecoAuto","False") == "True" && SystemInformation.PowerStatus.PowerLineStatus == PowerLineStatus.Offline;
    }
    void PowerChanged(object sender, Microsoft.Win32.PowerModeChangedEventArgs e) {
        if(!closing && IsHandleCreated) BeginInvoke((Action)delegate { UpdateEco(); Position(); });
    }
    void ReadTheme(){try{using(var key=Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"))nativeLight=Convert.ToInt32(key==null?0:key.GetValue("AppsUseLightTheme",0))!=0;}catch{nativeLight=false;}}
    void ThemeChanged(object sender,Microsoft.Win32.UserPreferenceChangedEventArgs e){if(!closing&&IsHandleCreated)BeginInvoke((Action)delegate{ReadTheme();Position();});}
    void ApplyNativeMaterial() {
        if(motion==null) return; // the motion host decides the material; never cache an identity before it exists (the ConsentWatcher used to run Position() first and pinned the acrylic accent)
        string requested=Setting("material","acrylic");
        string identity=requested+(nativeLight?":light":":dark");if(identity==appliedMaterial) return;
        appliedMaterial=identity; clippedSize=Size.Empty;
        // The DirectComposition motion host never gets the DWM accent: it tints the whole window rectangle (not clipped by the per-frame region on a NOREDIRECTIONBITMAP window), so the area outside the island showed #EDEDED. The island material is drawn by the renderer inside the shape only.
        if(motion!=null){ NativeMaterial.Apply(Handle,false,nativeLight); nativeAcrylic=requested=="acrylic" && NativeMaterial.Supported(); NativeLog.Write("material","host=motion accent=none requested="+requested); return; }
        nativeAcrylic=requested=="acrylic" && NativeMaterial.Apply(Handle,true,nativeLight);
        if(!nativeAcrylic) NativeMaterial.Apply(Handle,false,nativeLight);
    }
    void DisplayChanged(object s, EventArgs e) { if (!closing && IsHandleCreated) BeginInvoke((Action)Position); }
    string barKeyApplied=""; MotionOptions lastMotion; bool deferredPosition;
    bool revealed; string fullscreenSeen=""; readonly uint ownPid=(uint)Process.GetCurrentProcess().Id;
    // Real fullscreen = a foreign foreground window covering its whole monitor (monitor rect from GetMonitorInfo, visible frame from DWM), or Windows reporting a busy/D3D-fullscreen/presentation session. Islandly's own windows (owner, halo) never count.
    // Position() asks twice (policy and eye option) and runs on foreground/hover events: reuse one verdict per foreground window for 500 ms so DWM/shell queries stay off the pointer path.
    IntPtr[] fullscreenWindow=new IntPtr[2]; long[] fullscreenAt=new long[2]; bool[] fullscreenVerdict=new bool[2];
    bool Fullscreen(bool preference=true) {
        int slot=preference?1:0; IntPtr h=Native.GetForegroundWindow(); long now=clock.ElapsedMilliseconds;
        if(h==fullscreenWindow[slot] && now-fullscreenAt[slot]<500 && now>=fullscreenAt[slot]) return fullscreenVerdict[slot];
        bool result=FullscreenNow(preference); fullscreenWindow[slot]=h; fullscreenAt[slot]=now; fullscreenVerdict[slot]=result; return result;
    }
    bool FullscreenNow(bool preference) {
        if (preference && Setting("hideFullscreen","True").Equals("False",StringComparison.OrdinalIgnoreCase)) return false;
        IntPtr h = Native.GetForegroundWindow(); var name = new StringBuilder(128); Native.GetClassName(h,name,128);
        bool result=false; Native.RECT r=new Native.RECT(); Native.MONITORINFO mi=new Native.MONITORINFO(); string why=""; int quns=0;
        uint pid=0; if(h!=IntPtr.Zero) Native.GetWindowThreadProcessId(h,out pid);
        if (h == IntPtr.Zero) why="no-foreground";
        else if (h == Handle || pid == ownPid) why="own-window";
        else if (name.ToString() == "Progman" || name.ToString() == "WorkerW" || name.ToString() == "Shell_TrayWnd") why="shell";
        else {
            if (Native.DwmGetWindowAttribute(h,9,out r,Marshal.SizeOf(typeof(Native.RECT))) != 0 && !Native.GetWindowRect(h,out r)) why="no-rect";
            else {
                IntPtr monitor=Native.MonitorFromWindow(h,2); mi.size=Marshal.SizeOf(typeof(Native.MONITORINFO));
                if(monitor==IntPtr.Zero||!Native.GetMonitorInfo(monitor,ref mi)) why="no-monitor";
                else if(preference && Screen.FromHandle(h).DeviceName != TargetScreen().DeviceName) why="other-screen";
                else { result = r.left <= mi.monitor.left && r.top <= mi.monitor.top && r.right >= mi.monitor.right && r.bottom >= mi.monitor.bottom; why=result?"covers":"smaller"; }
            }
            // Exclusive-mode games and presentations may not cover the monitor with a normal window rect: ask the shell as well (busy, D3D fullscreen, presentation mode).
            long coverArea=(long)Math.Max(0,Math.Min(r.right,mi.monitor.right)-Math.Max(r.left,mi.monitor.left))*Math.Max(0,Math.Min(r.bottom,mi.monitor.bottom)-Math.Max(r.top,mi.monitor.top)), monitorArea=(long)Math.Max(1,mi.monitor.right-mi.monitor.left)*Math.Max(1,mi.monitor.bottom-mi.monitor.top);
            // Only a window that nearly fills its monitor can be a fullscreen game/presentation: skips the shell query (a COM round trip) for every ordinary foreground change.
            if (!result && why!="other-screen" && coverArea*10>=monitorArea*9) { try { if(Native.SHQueryUserNotificationState(out quns)==0 && (quns==2||quns==3||quns==4)) { result=true; why="shell-state-"+quns; } } catch(EntryPointNotFoundException) {} }
        }
        // Diagnostic for CI: log only when the foreground window or the verdict changes (no per-tick I/O).
        string seen=h.ToInt64()+"|"+result+"|"+why;
        if(preference && probe!="" && seen!=fullscreenSeen){fullscreenSeen=seen;NativeLog.Write("fullscreen-check","fg="+h.ToInt64()+" class="+name+" pid="+pid+" rect="+r.left+","+r.top+","+r.right+","+r.bottom+" monitor="+mi.monitor.left+","+mi.monitor.top+","+mi.monitor.right+","+mi.monitor.bottom+" own="+Handle.ToInt64()+" quns="+quns+" why="+why+" result="+result);}
        return result;
    }
    void Position() {
        if (closing || !IsHandleCreated) return;
        Counters.positions++;
        clockMinute=DateTime.Now.Hour*60+DateTime.Now.Minute;
        ApplyNativeMaterial();
        string mode=modeOverride == "" ? Setting("islandMode","overlay") : modeOverride;
        // "Show on mouse approach" never reserves the strip: hiding the island would release it and every reveal would re-reserve it, making other windows jump.
        bool reserved = !barBlocked && (mode == "appbar" || mode == "reserved-bar") && Setting("islandVisibility","always") != "approach";
        bool fs = Fullscreen();
        bool approach = !fs && Setting("islandVisibility","always") == "approach";
        if (!fs && !approach) revealed = false;
        // Fullscreen: hidden unless the mouse revealed it at the top edge. Approach mode: hidden until the cursor nears, but never while a panel is loading/open or the pointer is on it.
        bool away = (fs || approach) && !revealed && (fs || (child == null && !launching && !hoverArmed));
        bool hide = hidden || away;
        bool wantBar = reserved && !hide;
        if (wantBar != bar) {
            if (bar) RemoveBar();
            bar = wantBar; barKeyApplied="";
            if (bar) { abd = new Native.APPBARDATA(); abd.cbSize = Marshal.SizeOf(abd); abd.hWnd = Handle; abd.callback = 0x8001; MarkBar(); if(Native.SHAppBarMessage(0,ref abd).ToUInt64() == 0) { bar=false; DeleteBarMarker(); } }
        }
        float scale; if (!Single.TryParse(Setting("scale","0.8"), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture,out scale)) scale = .8f;
        scale = Math.Max(.5f, Math.Min(2f,scale)) * CreateGraphicsDpi();
        var screen = TargetScreen().Bounds;
        string autoHide=Setting("autoHide","auto");
        bool sliver = autoHide == "always" || autoHide == "auto" && (!TimerHasState() || clock.ElapsedMilliseconds-compactAt>=5000);
        if(privacyLabel != "" && Setting("micCamIndicator","True") != "False" || hoverArmed || launching || child!=null && !ready) sliver=false;
        if(Setting("idleEyes","False")=="True" && autoHide!="always") sliver=false;
        int strip=Setting("floating","False")=="True"?58:44;
        int w = (int)((sliver ? 84 : IslandGeometry.W)*scale), height = Math.Max(4,(int)((sliver ? 5 : IslandGeometry.H)*scale));
        if (bar) {
            // QUERYPOS/SETPOS only when the screen, the strip height or the scale changed (or the bar was just registered): every call makes the shell re-lay out the work area.
            string barKey=screen.ToString()+"|"+(int)(strip*scale);
            if(barKey!=barKeyApplied){
                barKeyApplied=barKey; var previous = abd.rect;
                abd.edge = 1; abd.rect = new Native.RECT { left = screen.Left, top = screen.Top, right = screen.Right, bottom = screen.Top + (int)(strip*scale) };
                Native.SHAppBarMessage(2,ref abd); abd.rect.bottom = abd.rect.top + (int)(strip*scale); if(previous.left != abd.rect.left || previous.right != abd.rect.right || previous.top != abd.rect.top || previous.bottom != abd.rect.bottom) { MarkBar(); Native.SHAppBarMessage(3,ref abd); }
            }
        }
        string pos = Setting("position","center");
        int x = pos == "left" ? screen.Left+16 : pos == "right" ? screen.Right-w-16 : screen.Left+(screen.Width-w)/2;
        bool floating=Setting("floating","False")=="True";
        if(floating) x=pos=="left"?screen.Left+(int)(20*scale):pos=="right"?screen.Right-w-(int)(20*scale):x;
        float anchorMargin=(floating?20:16)*scale;float center=pos=="left"?screen.Left+anchorMargin+IslandGeometry.HalfW*scale:pos=="right"?screen.Right-anchorMargin-IslandGeometry.HalfW*scale:screen.Left+screen.Width/2f,top=screen.Top+(sliver?0:(floating?14:8)*scale);
        Rectangle hotZone=Rectangle.Empty;
        if(motion!=null && hide && !hidden){ int zx=(int)(center-IslandGeometry.HalfW*scale-(approach?24*scale:0)), zw=(int)(IslandGeometry.W*scale+(approach?48*scale:0)); hotZone=new Rectangle(zx,screen.Top,zw,approach?(int)(top-screen.Top+IslandGeometry.H*scale+16*scale):Math.Max(2,(int)(2*scale))); }
        if(motion!=null){
            bool light=nativeLight;
            bool compact=TimerHasState()||privacyLabel!=""||SystemInformation.PowerStatus.BatteryChargeStatus!=BatteryChargeStatus.NoSystemBattery&&SystemInformation.PowerStatus.BatteryLifePercent<.2f;
            string lang=Setting("uiLang",Setting("lang","ar"));if(lang=="auto")lang=Setting("lang","ar");
            bool loadingNow=RefreshLoading("position");
            string label=MotionLabel();
            lastMotion=new MotionOptions{screen=screen,scale=scale,center=center,top=top,eyes=Setting("idleEyes","False")=="True",eco=nativeEco,mode=Setting("motion","full"),fullscreen=Fullscreen(false),hotZone=hotZone,compact=compact,sliver=sliver,light=light,rtl=lang!="en",acrylic=false,floating=floating,hidden=hide,loading=loadingNow,label=label,date=DateTime.Now.ToString("D",System.Globalization.CultureInfo.GetCultureInfo(lang=="en"?"en-US":"ar-SA"))};motion.Configure(lastMotion);
            if(!hide && !ready && !Visible){Show();motion.PlaceHaloNow();}
            return;
        }
        SetBounds(x,(int)top,w,height);
        Visible=!hide&&!ready;
    }

    Screen TargetScreen() {
        string id=Setting("monitorId",""); object maps;
        if(id != "" && state.TryGetValue("monitors",out maps) && maps is IEnumerable) {
            foreach(var item in (IEnumerable)maps) {
                var map=item as Dictionary<string,object>; if(map == null || Convert.ToString(map["id"]) != id) continue;
                var match=Screen.AllScreens.FirstOrDefault(s => s.Bounds.Left == Convert.ToInt32(map["x"]) && s.Bounds.Top == Convert.ToInt32(map["y"]));
                if(match != null) return match;
            }
        }
        return Screen.PrimaryScreen;
    }
    float CreateGraphicsDpi() { try { return Native.GetDpiForWindow(Handle)/96f; } catch(EntryPointNotFoundException) { using(var g=CreateGraphics()) return g.DpiX/96f; } }
    protected override void OnPaintBackground(PaintEventArgs e) {
        if(motion!=null)return;
        if(nativeAcrylic) e.Graphics.Clear(Color.Black); else base.OnPaintBackground(e);
    }
    protected override void OnPaint(PaintEventArgs e) {
        if(motion!=null){if(launching&&!loadingPainted){loadingPainted=true;NativeLog.Write("loading-paint","inputToPaintMs="+(clock.ElapsedMilliseconds-requestAt));}return;}
        base.OnPaint(e);
        if(launching && !loadingPainted) { loadingPainted=true; NativeLog.Write("loading-paint","inputToPaintMs="+(clock.ElapsedMilliseconds-requestAt)); }
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        if (Height < 12) { using(var brush=new SolidBrush(TimerRunning() ? Color.FromArgb(167,139,250) : Color.FromArgb(76,76,76))) e.Graphics.FillRectangle(brush,ClientRectangle); return; }
        if(!nativeAcrylic) using(var gradient=new LinearGradientBrush(ClientRectangle,Color.FromArgb(12,12,16),Color.Black,90f)) e.Graphics.FillRectangle(gradient,ClientRectangle);
        if(hoverArmed) using(var pen=new Pen(Color.FromArgb(167,139,250),2)) e.Graphics.DrawRectangle(pen,1,1,Math.Max(1,Width-3),Math.Max(1,Height-3));
        string label=CompactLabel();
        using(var brush = new SolidBrush(Color.FromArgb(167,139,250))) e.Graphics.FillEllipse(brush,Width*.16f,Height*.42f,Height*.16f,Height*.16f);
        using(var font = new Font("Segoe UI",Math.Max(8,Height*.32f),FontStyle.Regular,GraphicsUnit.Pixel)) TextRenderer.DrawText(e.Graphics,label,font,new Rectangle((int)(Width*.2f),0,(int)(Width*.7f),Height),ForeColor,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter);
    }
    string CompactLabel(){
        string label = DateTime.Now.ToString("HH:mm");
        if (TimerHasState()) { long end = Convert.ToInt64(state["endAt"]); var left = TimerRunning() ? Math.Max(0,(end-DateTimeOffset.UtcNow.ToUnixTimeMilliseconds())/1000) : (long)Math.Ceiling(Convert.ToDouble(state["remaining"])); label = (left/60).ToString("00")+":"+(left%60).ToString("00"); }
        if(privacyLabel != "" && Setting("micCamIndicator","True") != "False") label = privacyLabel;
        else if(!TimerRunning() && SystemInformation.PowerStatus.BatteryChargeStatus != BatteryChargeStatus.NoSystemBattery && SystemInformation.PowerStatus.BatteryLifePercent < .2f) label = ((int)(SystemInformation.PowerStatus.BatteryLifePercent*100))+"%";
        if(RefreshLoading("label")) label=Setting("uiLang",Setting("lang","ar"))=="en"?"Loading…":"جارٍ التحميل…";
        return label;
    }
    // The "Loading…" caption. Click launch: shown at once. Hover launch: only after 300 ms and while the pointer is still on the island. A cancelled launch never shows it, even though the session lives on until it ends. Show and clear are logged with timestamps.
    bool RefreshLoading(string reason) {
        bool want=!cancelLaunch&&(launching||child!=null&&!ready)&&(!hoverLaunch||clock.ElapsedMilliseconds-requestAt>300&&motion!=null&&motion.ContainsPointer());
        if(want==loadingShown) return want;
        loadingShown=want; long now=clock.ElapsedMilliseconds;
        if(want) { loadingShownAt=now; NativeLog.Write("loading-label","show at="+now+" sinceRequestMs="+(now-requestAt)+" origin="+(hoverLaunch?"hover":"click")); }
        else NativeLog.Write("loading-label","clear at="+now+" shownMs="+(now-loadingShownAt)+" reason="+reason);
        return want;
    }
    bool TimerHasState() { object remaining,total; return TimerRunning() || state.TryGetValue("remaining",out remaining) && state.TryGetValue("total",out total) && Convert.ToDouble(remaining)>0 && Convert.ToDouble(remaining)<Convert.ToDouble(total); }
    bool TimerRunning() { object running; return state.TryGetValue("running",out running) && running is bool && (bool)running; }
    static string Quote(string value) {
        var text=new StringBuilder("\""); int slashes=0;
        foreach(char c in value) { if(c=='\\') { slashes++; continue; } text.Append('\\',c=='"'?slashes*2+1:slashes); slashes=0; text.Append(c); }
        return text.Append('\\',slashes*2).Append('"').ToString();
    }
    public void ReportFailure(string stage,Exception ex) {
        NativeLog.Write(stage,ex);
        if(tray!=null && clock.ElapsedMilliseconds-lastFailureNotice>=5000 || tray!=null && lastFailureNotice==0) {
            lastFailureNotice=clock.ElapsedMilliseconds;
            string notice=LaunchPolicy.IsBlocked(ex)?LaunchPolicy.Notice:"Could not open the panel. Retrying once; click the island to try again. Details: native-panels.log in your Islandly data folder.";
            try { tray.ShowBalloonTip(5000,"Islandly",notice,ToolTipIcon.Warning); } catch { }
        }
    }
    async void OpenPanel(string command,string origin="command",bool retry=false) {
        hoverArmed=false; hoverDwell.Stop();
        if(policyBlockedHover && origin=="hover") return;
        if(closing || launching || clock.ElapsedMilliseconds<nextLaunchAt) return;
        if(child!=null) { if(ready) Send(command); return; }
        cancelLaunch=false;hoverLaunch=origin=="hover"; if(command=="expand"&&motion!=null)motion.Open(true);
        launchRetry.Stop(); retryCommand=""; launching=true; requestAt=clock.ElapsedMilliseconds; loadingPainted=false; loadingGate.Stop(); if(hoverLaunch) loadingGate.Start(); Position(); Update();
        try { await OpenPanelCore(command,origin); if(cancelLaunch){EndSession();return;} policyBlockedHover=false; }
        catch(Exception ex) {
            // Capture API errors at the call site, before any disposal/positioning calls.
            try { EndSession(); } catch(Exception cleanup) { NativeLog.Write("launch-cleanup",cleanup); }
            nextLaunchAt=clock.ElapsedMilliseconds+1000;
            if(LaunchPolicy.IsBlocked(ex)) {
                policyBlockedHover=true;
                NativeLog.Write("launch-policy-block","automatic retry and subsequent hover launches suppressed; a signed/trusted build is required; explicit user action can retry after replacement");
            }
            ReportFailure("launch-failed origin="+origin,ex);
            if(LaunchPolicy.ShouldRetry(ex,retry) && !closing) {
                retryCommand=command; launchRetry.Start();
            }
        } finally { launching=false; if(!closing) { Position(); Status(); } }
    }
    async Task OpenPanelCore(string command,string origin) {
        string stage="validate";
        NativeLog.Write("launch-request","origin="+origin+" root="+root+" executable="+electron);
        if(!Directory.Exists(root)) throw new DirectoryNotFoundException("Panel resources directory does not exist: "+root);
        if(!File.Exists(electron)) throw new FileNotFoundException("Panel runtime not installed or available locally",electron);
        if(Marshal.SizeOf(typeof(Native.STARTUPINFO))!=104 || Marshal.SizeOf(typeof(Native.PROCESSINFO))!=24 || Marshal.SizeOf(typeof(Native.EXTENDEDLIMIT))!=144)
            throw new InvalidOperationException("Unexpected x64 Win32 structure layout");
        state["breakActive"]=breakSeconds/60.0; SaveState();
        try {
            stage="CreateJobObject"; job=Native.CreateJobObject(IntPtr.Zero,null);
            if(job==IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(),stage);
            var limit=new Native.EXTENDEDLIMIT(); limit.basic.flags=0x2000;
            stage="SetInformationJobObject";
            if(!Native.SetInformationJobObject(job,9,ref limit,Marshal.SizeOf(limit))) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(),stage);
            stage="named-session-pipe";
            string pipeName="Islandly-"+Guid.NewGuid().ToString("N");
            var security=new PipeSecurity(); security.AddAccessRule(new PipeAccessRule(WindowsIdentity.GetCurrent().User,PipeAccessRights.FullControl,AccessControlType.Allow));
            sessionPipe=new NamedPipeServerStream(pipeName,PipeDirection.InOut,1,PipeTransmissionMode.Byte,PipeOptions.Asynchronous,65536,65536,security);
            var pipe=sessionPipe;
            pipe.BeginWaitForConnection(delegate(IAsyncResult result) {
                try { pipe.EndWaitForConnection(result); if(closing || pipe!=sessionPipe) return;
                    BeginInvoke((Action)(() => { if(closing || pipe!=sessionPipe) return; childInput=new StreamWriter(pipe,new UTF8Encoding(false)); childInput.AutoFlush=true; ReadSession(pipe); }));
                } catch(ObjectDisposedException) {} catch(IOException) {} catch(Exception ex) { NativeLog.Write("pipe-connect",ex); }
            },null);
            var startup=new Native.STARTUPINFO(); startup.cb=(uint)Marshal.SizeOf(startup);
            // Protocol is on the named pipe. A GUI child needs no inherited standard handles.
            var environment=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);
            foreach(DictionaryEntry entry in Environment.GetEnvironmentVariables()) environment[(string)entry.Key]=(string)entry.Value;
            environment["ISLANDLY_NATIVE_PIPE"]=pipeName; environment["ISLANDLY_NATIVE_SESSION"]="1";
            var anchor=TargetScreen().Bounds;float anchorScale;Single.TryParse(Setting("scale","0.8"),System.Globalization.NumberStyles.Float,System.Globalization.CultureInfo.InvariantCulture,out anchorScale);anchorScale=Math.Max(.5f,Math.Min(2f,anchorScale))*CreateGraphicsDpi();string anchorPosition=Setting("position","center");float margin=(Setting("floating","False")=="True"?20:16)*anchorScale;
            environment["ISLANDLY_NATIVE_ANCHOR"]=json.Serialize(new{center=anchorPosition=="left"?anchor.Left+margin+IslandGeometry.HalfW*anchorScale:anchorPosition=="right"?anchor.Right-margin-IslandGeometry.HalfW*anchorScale:anchor.Left+anchor.Width/2f,top=anchor.Top+(Setting("floating","False")=="True"?14:8)*anchorScale});
            environment["ISLANDLY_NATIVE_PROFILE"]=profile; environment["ISLANDLY_NATIVE_COMMAND"]=command;
            if(probe!="") environment["ISLANDLY_NATIVE_PROBE"]="1";
            string block=String.Join("\0",environment.Select(pair=>pair.Key+"="+pair.Value))+"\0\0";
            string cwd=Path.GetFullPath(Path.GetDirectoryName(electron));
            if(!Directory.Exists(cwd)) throw new DirectoryNotFoundException("Panel working directory unavailable: "+cwd);
            string arguments=Quote(electron)+(packaged?"":" "+Quote(root))+" --enable-logging=file --log-level=2 --log-file="+Quote(Path.Combine(profile,"panel-chromium.log"));
            // SAC may spend tens of seconds here. Only the worker waits; the native UI keeps painting.
            var pi=new Native.PROCESSINFO();
            stage="CreateProcessW";
            await Task.Run(delegate {
                if(probeLaunchDelay>0) Thread.Sleep(Math.Min(probeLaunchDelay,45000));
                uint previousErrorMode;
                if(!Native.SetThreadErrorMode(0x8003,out previousErrorMode)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(),"SetThreadErrorMode");
                IntPtr env=IntPtr.Zero;
                try {
                    env=Marshal.StringToHGlobalUni(block);
                    NativeLog.Write("CreateProcessW","cwd="+cwd+" flags=0x08000404 inherit=false STARTUPINFO=104 PROCESS_INFORMATION=24 JOB_EXTENDED_LIMIT=144 envChars="+block.Length);
                    bool started=Native.CreateProcess(electron,new StringBuilder(arguments),IntPtr.Zero,IntPtr.Zero,false,0x08000404,env,cwd,ref startup,out pi);
                    int error=Marshal.GetLastWin32Error();
                    if(!started) throw new System.ComponentModel.Win32Exception(error,"CreateProcessW failed (Win32 "+error+")");
                    // Own the suspended child before returning to the UI, even if the host closes meanwhile.
                    if(closing || !Native.AssignProcessToJobObject(job,pi.process)) {
                        int assignError=Marshal.GetLastWin32Error();
                        try { Process.GetProcessById(pi.pid).Kill(); } catch {}
                        Native.CloseHandle(pi.thread); Native.CloseHandle(pi.process);
                        throw new System.ComponentModel.Win32Exception(assignError,"AssignProcessToJobObject/host closed");
                    }
                } finally { if(env!=IntPtr.Zero) Marshal.FreeHGlobal(env); uint ignored; Native.SetThreadErrorMode(previousErrorMode,out ignored); }
            });
            ready=false;sessionHydrated=panelGeometryReceived=panelPresentRequested=false; shutdownAt=0; lastCommand=command;
            try {
                if(closing) throw new OperationCanceledException("Host closed during process creation");
                stage="AssignProcessToJobObject";

                child=Process.GetProcessById(pi.pid);
                stage="ResumeThread";
                if(Native.ResumeThread(pi.thread)==UInt32.MaxValue) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(),stage);
                launchedAt=clock.ElapsedMilliseconds;
            } catch { try { Process.GetProcessById(pi.pid).Kill(); } catch {} throw; }
            finally { Native.CloseHandle(pi.thread); Native.CloseHandle(pi.process); }
            launchCount++; NativeLog.Write("launch-started","origin="+origin+" pid="+child.Id); Status();
        } catch(Exception ex) { NativeLog.Write("launch-stage="+stage,ex); throw; }
    }
    async void ReadSession(NamedPipeServerStream pipe) {
        try { using(var reader=new StreamReader(pipe,Encoding.UTF8,true,65536,true)) {
            string line; while((line=await reader.ReadLineAsync()) != null) {
                if(closing || pipe != sessionPipe) return;
                if(line.StartsWith("ISLANDLY:")) Message(line);
            }
        } } catch(ObjectDisposedException) {} catch(IOException) {}
    }
    void Send(string command) { try { if(childInput != null) childInput.WriteLine(command); } catch {} }
    void Message(string line) {
        if(child == null) return;
        if(line.StartsWith("ISLANDLY:shell:")) {
            int id=0; string error="";
            try {
                var request=json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(Convert.FromBase64String(line.Substring(15))));
                id=Convert.ToInt32(request["id"]); string kind=Convert.ToString(request["kind"]), target=Convert.ToString(request["target"]);
                if(target.Length>32768) throw new Exception("Target too long");
                if(kind == "url") { Uri url; if(!Uri.TryCreate(target,UriKind.Absolute,out url) || (url.Scheme != "http" && url.Scheme != "https")) throw new Exception("Unsupported URL"); }
                else if(kind != "path" && kind != "reveal" || !Path.IsPathRooted(target)) throw new Exception("Unsupported path");
                // Shell activation is requested by the user, outside the panel-runtime job.
                using(var process=Process.Start(new ProcessStartInfo(kind == "reveal" ? "explorer.exe" : target,kind == "reveal" ? "/select,\""+target.Replace("\"","")+"\"" : "") { UseShellExecute=true })) {}
            } catch(Exception ex) { error=ex.Message; }
            Send("shell-result:"+id+":"+Convert.ToBase64String(Encoding.UTF8.GetBytes(error)));
            return;
        }
        if(line == "ISLANDLY:settings:") { ReadSettings(); Position(); return; }
        if(line.StartsWith("ISLANDLY:panel:ready:")) {
            try {var bounds=json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(Convert.FromBase64String(line.Substring(21))));panelGeometryReceived=true;if(motion!=null)motion.Ready(Convert.ToSingle(bounds["width"]),Convert.ToSingle(bounds["height"]),delegate{if(cancelLaunch||closing)return;panelPresentRequested=true;Send("present");if(sessionHydrated)MarkReady();});}catch(Exception ex){NativeLog.Write("panel-ready-geometry",ex);}return;
        }
        if(line == "ISLANDLY:ready:") {sessionHydrated=true;if(panelGeometryReceived&&!panelPresentRequested)return;if(lastCommand!="expand"&&lastCommand!="pomodoro"&&motion!=null)motion.Hide();MarkReady();}
        if(line == "ISLANDLY:idle:") { if(motion!=null)motion.Open(false); shutdownAt = clock.ElapsedMilliseconds; }
        if(line == "ISLANDLY:restart:") { EndSession(); OpenPanel("settings"); return; }
        if(line == "ISLANDLY:exit:") { Close(); return; }
        if(line.StartsWith("ISLANDLY:state:")) {
            pendingClipboard.Clear();
            try { var next = json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(Convert.FromBase64String(line.Substring(15))));
                object previousEnd, nextEnd; if(next.TryGetValue("endAt",out nextEnd) && (!state.TryGetValue("endAt",out previousEnd) || Convert.ToString(previousEnd) != Convert.ToString(nextEnd))) compactAt=clock.ElapsedMilliseconds;
                state = next;
                object activeBreak; if(state.TryGetValue("breakActive",out activeBreak)) breakSeconds=(int)(Math.Max(0,Convert.ToDouble(activeBreak))*60);
                SaveState();
            } catch {} // invalid child data never becomes a command
        }
    }
    void MarkReady(){if(ready)return;ready=true;hasLaunchedSuccessfully=true;readyAt=clock.ElapsedMilliseconds;latencies.Enqueue(readyAt-requestAt);Position();Status();}
    void SaveState() { try { string file = Path.Combine(profile,"native-session.json"); File.WriteAllText(file+".tmp",json.Serialize(state)); if(File.Exists(file)) File.Replace(file+".tmp",file,null); else File.Move(file+".tmp",file); stateWrittenAt = clock.ElapsedMilliseconds; } catch(IOException) {} }
    void EndSession() {
        NativeLog.Write("session-end","ready="+ready+" launching="+launching+" cancel="+cancelLaunch+" hover="+hoverLaunch+" shutdownAt="+shutdownAt+" childExited="+(child==null?"none":child.HasExited.ToString()));
        ready = false; if(motion!=null)motion.Open(false);
        if(job != IntPtr.Zero) { Native.TerminateJobObject(job,0); Native.CloseHandle(job); job = IntPtr.Zero; }
        if(child != null) { child.Dispose(); child = null; }
        if(childInput != null) { try { childInput.Dispose(); } catch(IOException) {} catch(ObjectDisposedException) {} childInput = null; }
        if(sessionPipe != null) { sessionPipe.Dispose(); sessionPipe=null; }
        shutdownAt = 0; Position(); Status();
    }
    void Tick(object sender, EventArgs e) {
        Counters.ticks++;
        bool settingsChanged=ReadSettings();
        bool background=BackgroundNeeded(); if(!background) lastBackground=clock.ElapsedMilliseconds;
        if(background && clock.ElapsedMilliseconds-lastBackground >= 5000) { int seconds=lastBackground==0?5:(int)Math.Max(5,Math.Min(120,(clock.ElapsedMilliseconds-lastBackground)/1000)); lastBackground=clock.ElapsedMilliseconds; if(child == null) BackgroundTick(seconds); }
        if(!launching && child != null && (child.HasExited || shutdownAt > 0 && clock.ElapsedMilliseconds-shutdownAt > 1500 || !ready && clock.ElapsedMilliseconds-launchedAt > (hasLaunchedSuccessfully?60000:120000))) EndSession();
        if(TimerRunning() && Convert.ToInt64(state["endAt"]) <= DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() && child == null) {
            state["running"] = false; state["remaining"] = 0; state["completed"] = true; SaveState();
            Position();System.Media.SystemSounds.Asterisk.Play(); tray.ShowBalloonTip(5000,"Islandly","Timer complete",ToolTipIcon.Info);
        }
        if(settingsChanged||TimerHasState()||child!=null||launching)Position();else if(clockMinute!=DateTime.Now.Hour*60+DateTime.Now.Minute)MinuteChanged();
        if(probe != "") {
            string commandFile = Path.Combine(probe,"command.txt");
            string command = ""; if(File.Exists(commandFile)) { try { command = ReadShared(commandFile).Trim(); if(command != "") File.Delete(commandFile); } catch(IOException) { command = ""; } } // the watcher can fire before the writer finished: an empty or locked file is retried
            if(command != "") {
                if(command == "measure") measuring = true;
                else if(command == "exit") Close();
                else if(command == "close") {if(motion!=null)motion.Open(false);Send("close");}
                else if(command.StartsWith("motion-") && motion!=null)motion.Probe(command);
                else if(new[]{"expand","settings","palette","pomodoro"}.Contains(command)) OpenPanel(command);
            }
            if(!quietProbe)Status();
        }
        if(closing) return;
        // Nothing running: wake once a minute (clock label) instead of every second. Settings and commands arrive through the file watchers.
        bool busy = settingsChanged || TimerHasState() || child != null || launching || (probe != "" && !quietProbe) || clock.ElapsedMilliseconds - activityAt < 5000;
        int want = busy ? 1000 : (int)Math.Max(1000, Math.Min(60000, (60 - DateTime.Now.Second) * 1000 - DateTime.Now.Millisecond + 100));
        if(background) want = Math.Min(want, 5000);
        if(ticker.Interval != want) ticker.Interval = want;
    }
    int[] JobPids() {
        if(job == IntPtr.Zero) return new int[0];
        IntPtr buffer = Marshal.AllocHGlobal(8+8*4096);
        try { uint count; if(!Native.QueryInformationJobObject(job,3,buffer,8+8*4096,out count)) throw new Exception("Cannot enumerate panel ownership");
            int n = Marshal.ReadInt32(buffer,4); var ids = new int[n]; for(int i=0;i<n;i++) ids[i]=(int)Marshal.ReadInt64(buffer,8+8*i); return ids;
        } finally { Marshal.FreeHGlobal(buffer); }
    }
    void Status() {
        if(probe == "" || closing) return;
        var ids = JobPids().Concat(new[]{Process.GetCurrentProcess().Id}).Distinct().ToArray();
        var processes = new List<object>(); double total = 0, totalCPU=0; long now=clock.ElapsedMilliseconds;
        foreach(int id in ids) try { using(var p=Process.GetProcessById(id)) { double mb=p.WorkingSet64/1048576.0; total+=mb; double time=p.TotalProcessorTime.TotalMilliseconds, previous;
            double cpu=cpuTimes.TryGetValue(id,out previous) && now>cpuSampleAt ? Math.Max(0,(time-previous)/(now-cpuSampleAt)*100) : 0; cpuTimes[id]=time; totalCPU+=cpu;
            processes.Add(new { pid=id, name=p.ProcessName, mb=mb, cpu=cpu }); } } catch(ArgumentException) {}
        cpuSampleAt=now;
        var data = new { hostPid=Process.GetCurrentProcess().Id, phase=launching?"starting":child == null ? "idle" : ready ? "panel" : "starting", motion=motion==null?null:motion.Report, hotkey=islandHotkey, processStartedMs=launchedAt, requestMs=requestAt, eco=nativeEco, material=nativeAcrylic?"acrylic":"glass", materialSupported=NativeMaterial.Supported(), averageNotApplicable=true, totalMB=total, totalCPU=totalCPU, processes=processes, launchCount=launchCount, latenciesMs=latencies.ToArray(), appBar=bar, appBarTop=abd.rect.top, appBarBottom=abd.rect.bottom, stateAgeMs=clock.ElapsedMilliseconds-stateWrittenAt, command=lastCommand };
        string file=Path.Combine(probe,"status.json"); try { NativeStatusPublication.Publish(file,json.Serialize(data)); } catch(IOException) {}
    }
    void DeleteBarMarker() { try { File.Delete(Path.Combine(profile,"native-appbar-marker.json")); } catch {} }
    void MarkBar() {
        var data=new { pid=Process.GetCurrentProcess().Id, start=Process.GetCurrentProcess().StartTime.ToUniversalTime().Ticks.ToString(), edge=1,
            left=abd.rect.left,top=abd.rect.top,right=abd.rect.right,bottom=abd.rect.bottom, hwnd=Handle.ToInt64().ToString() };
        string file=Path.Combine(profile,"native-appbar-marker.json");
        using(var stream=new FileStream(file+".tmp",FileMode.Create,FileAccess.Write,FileShare.None)) { byte[] bytes=Encoding.UTF8.GetBytes(json.Serialize(data)); stream.Write(bytes,0,bytes.Length); stream.Flush(true); }
        if(File.Exists(file)) File.Replace(file+".tmp",file,null); else File.Move(file+".tmp",file);
    }
    void RemoveBar() { if(Native.SHAppBarMessage(1,ref abd).ToUInt64() != 0) DeleteBarMarker(); }
    void RecoverBar() {
        string file=Path.Combine(profile,"native-appbar-marker.json"); if(!File.Exists(file)) return;
        try {
            var old=json.Deserialize<Dictionary<string,object>>(File.ReadAllText(file));
            try { using(var process=Process.GetProcessById(Convert.ToInt32(old["pid"]))) {
                if(process.StartTime.ToUniversalTime().Ticks.ToString() == Convert.ToString(old["start"])) { barBlocked=true; return; }
            } } catch(ArgumentException) {}
            // Never REMOVE a saved HWND: it may have been recycled. Use our fresh live window.
            var recovery=new Native.APPBARDATA(); recovery.cbSize=Marshal.SizeOf(recovery); recovery.hWnd=Handle; recovery.callback=0x8001; recovery.edge=1;
            if(Native.SHAppBarMessage(0,ref recovery).ToUInt64() == 0) { barBlocked=true; return; }
            try {
                recovery.rect=new Native.RECT { left=Convert.ToInt32(old["left"]),top=Convert.ToInt32(old["top"]),right=Convert.ToInt32(old["right"]),bottom=Convert.ToInt32(old["bottom"]) };
                if(recovery.rect.right>recovery.rect.left && recovery.rect.bottom>recovery.rect.top) { Native.SHAppBarMessage(2,ref recovery); Native.SHAppBarMessage(3,ref recovery); }
            } finally { if(Native.SHAppBarMessage(1,ref recovery).ToUInt64() != 0) DeleteBarMarker(); else barBlocked=true; }
        } catch { barBlocked=true; }
    }
    string MotionLabel() {
        string label=motion.Opening?DateTime.Now.ToString("HH:mm"):CompactLabel();if(Setting("digits","latn")=="arab")for(int i=0;i<10;i++)label=label.Replace((char)('0'+i),(char)('٠'+i));
        return label;
    }
    // A minute boundary only changes the clock text: redraw the label from the last options instead of a full Position() (no shell, display or AppBar work).
    void MinuteChanged() {
        clockMinute=DateTime.Now.Hour*60+DateTime.Now.Minute;
        if(motion==null||lastMotion==null||TimerHasState()||child!=null||launching){Position();return;}
        var next=lastMotion.Clone();next.label=MotionLabel();next.date=DateTime.Now.ToString("D",System.Globalization.CultureInfo.GetCultureInfo(next.rtl?"ar-SA":"en-US"));
        lastMotion=next;motion.Configure(next);
    }
    bool BackgroundNeeded() { if(nativeEco) return false; int every; Int32.TryParse(Setting("breakEvery","60"),out every); return Setting("timeTracking","True")!="False"||every>0; }
    void BackgroundTick(int seconds) {
        var input=new Native.LASTINPUT(); input.size=(uint)Marshal.SizeOf(input);
        bool active=Native.GetLastInputInfo(ref input) && unchecked((uint)Environment.TickCount-input.time)<60000;
        if(Setting("timeTracking","True") != "False" && !nativeEco && active) {
            try {
                uint pid; Native.GetWindowThreadProcessId(Native.GetForegroundWindow(),out pid);
                string name; using(var p=Process.GetProcessById((int)pid)) name=p.ProcessName;
                string[] skip={"Islandly","IslandlyPanels","electron","LockApp","SearchHost","SearchApp","ShellExperienceHost","StartMenuExperienceHost","TextInputHost"};
                if(!skip.Contains(name,StringComparer.OrdinalIgnoreCase)) {
                    string friendly;
                    if(FriendlyNames.TryGetValue(name,out friendly)) name=friendly;
                    else if(name.Equals("ApplicationFrameHost",StringComparison.OrdinalIgnoreCase)) {
                        var title=new StringBuilder(512); Native.GetWindowText(Native.GetForegroundWindow(),title,512);
                        name=title.ToString().Split(new[]{" - "},StringSplitOptions.None).Last().Trim();
                        if(name == "") name="Store app"; if(name.Length>40) name=name.Substring(0,40);
                    }
                    string file=Path.Combine(profile,"usage.json"); Dictionary<string,object> usage;
                    try { usage=json.Deserialize<Dictionary<string,object>>(File.ReadAllText(file)); } catch { usage=new Dictionary<string,object>(); }
                    string day=DateTime.Now.ToString("yyyy-MM-dd"); object data;
                    var counts=usage.TryGetValue(day,out data) ? data as Dictionary<string,object> : null;
                    if(counts == null) { counts=new Dictionary<string,object>(); usage[day]=counts; }
                    object previous; counts[name]=(counts.TryGetValue(name,out previous)?Convert.ToInt32(previous):0)+seconds;
                    foreach(string old in usage.Keys.OrderBy(x=>x).Take(Math.Max(0,usage.Count-14)).ToArray()) usage.Remove(old);
                    File.WriteAllText(file+".tmp",json.Serialize(usage)); if(File.Exists(file)) File.Replace(file+".tmp",file,null); else File.Move(file+".tmp",file);
                }
            } catch {}
        }
        int every; Int32.TryParse(Setting("breakEvery","60"),out every);
        if(!active) { if(unchecked((uint)Environment.TickCount-input.time)>=300000) breakSeconds=0; }
        else if(every>0 && (breakSeconds+=5)>=every*60) { breakSeconds=0; tray.ShowBalloonTip(5000,"Islandly","Time for a short break",ToolTipIcon.Info); }
    }
    void ToggleStartup() {
        using(var key=Microsoft.Win32.Registry.CurrentUser.CreateSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Run")) {
            if(key.GetValue("Islandly") != null) key.DeleteValue("Islandly");
            else key.SetValue("Islandly","\""+Application.ExecutablePath+"\""+(packaged ? "" : " --root \""+root+"\""));
        }
    }
    protected override void WndProc(ref Message m) {
        if(probe!="" && motion!=null && m.Msg==0x8021){motion.Probe(m.WParam.ToInt32()==0?"motion-close":m.WParam.ToInt32()==2?"motion-measure":m.WParam.ToInt32()==3?"motion-alpha":"motion-open");return;} /* no Status() here: its process enumeration and file write ran on the UI thread right as the burst started and delayed its first frames; Refresh (0x8022) publishes the status on demand */
        if(probe!="" && motion!=null && m.Msg==0x8022){ReadSettings();Position();Status();File.WriteAllText(Path.Combine(probe,"motion-frames.json"),json.Serialize(motion.FrameSamples));return;}
        if(taskbarCreated != 0 && m.Msg == taskbarCreated) { bar=false; DeleteBarMarker(); Position(); }
        if(m.Msg == 0x031D && child == null && Setting("clipboard","True") != "False") {
            try { if(Clipboard.ContainsText()) { string text=Clipboard.GetText(); if(text.Length > 5000) text=text.Substring(0,5000);
                if(text != "") { pendingClipboard.Remove(text); pendingClipboard.Add(text); while(pendingClipboard.Count > 30) pendingClipboard.RemoveAt(0); state["clipboardPending"]=pendingClipboard.ToArray(); SaveState(); }
            } } catch(System.Runtime.InteropServices.ExternalException) {}
        }
        if(m.Msg == 0x0312) { int id=m.WParam.ToInt32(); OpenPanel(id==2?"palette":id==3?"pomodoro":id==4?"stash":"expand","hotkey"); }
        if(m.Msg==0x02e0&&!closing)BeginInvoke((Action)Position);
        if(m.Msg == 0x8001 && m.WParam.ToInt32() == 1) BeginInvoke((Action)Position);
        base.WndProc(ref m);
    }
    void Cleanup() {
        leaveGrace.Stop();leaveGrace.Dispose();if(motion!=null){motion.Dispose();motion=null;}
        if(closing) return; closing=true;if(foregroundWatcher!=null)foregroundWatcher.Dispose();
        launchRetry.Stop(); launchRetry.Dispose(); loadingGate.Stop(); loadingGate.Dispose(); ticker.Stop(); hoverDwell.Stop();
        Microsoft.Win32.SystemEvents.DisplaySettingsChanged -= DisplayChanged;
        Microsoft.Win32.SystemEvents.PowerModeChanged -= PowerChanged;
        Microsoft.Win32.SystemEvents.UserPreferenceChanged -= ThemeChanged;
        if(bar) { RemoveBar(); bar=false; }
        for(int i=1;i<=4;i++) Native.UnregisterHotKey(Handle,i);
        Native.RemoveClipboardFormatListener(Handle); if(consent != null) consent.Dispose();
        state["breakActive"]=breakSeconds/60.0; SaveState();
        Send("quit"); EndSession(); tray.Visible=false; tray.Dispose(); ticker.Dispose(); hoverDwell.Dispose();
    }
}
sealed class ConsentWatcher : IDisposable {
    Microsoft.Win32.RegistryKey key;
    EventWaitHandle changed;
    RegisteredWaitHandle registration;
    readonly Action<string> update;
    readonly SynchronizationContext context = SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext();
    bool stopped;
    public ConsentWatcher(Action<string> update) {
        this.update=update;
        try {
            key=Microsoft.Win32.Registry.CurrentUser.OpenSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore");
            if(key == null) return;
            changed=new EventWaitHandle(false,EventResetMode.AutoReset);
            Arm(); Read();
        } catch { Dispose(); }
    }
    void Arm() {
        if(stopped) return;
        if(Native.RegNotifyChangeKeyValue(key.Handle.DangerousGetHandle(),true,0x10000005,changed.SafeWaitHandle.DangerousGetHandle(),true) != 0) return;
        registration=ThreadPool.RegisterWaitForSingleObject(changed,delegate(object state,bool timeout) {
            if(stopped) return;
            context.Post(delegate(object unused) { if(!stopped) { Arm(); Read(); } },null);
        },null,Timeout.Infinite,true);
    }
    bool Active(Microsoft.Win32.RegistryKey node,int depth) {
        if(node == null || depth>6) return false;
        object start=node.GetValue("LastUsedTimeStart"), stop=node.GetValue("LastUsedTimeStop");
        if(start is long && (long)start != 0 && stop is long && (long)stop == 0) return true;
        foreach(string sub in node.GetSubKeyNames().Take(1024)) using(var child=node.OpenSubKey(sub)) if(Active(child,depth+1)) return true;
        return false;
    }
    void Read() {
        try { bool mic,cam; using(var m=key.OpenSubKey("microphone")) mic=Active(m,0); using(var c=key.OpenSubKey("webcam")) cam=Active(c,0);
            update(cam ? "Camera active" : mic ? "Mic active" : "");
        } catch { }
    }
    public void Dispose() { stopped=true; if(registration != null) registration.Unregister(null); if(key != null) key.Dispose(); if(changed != null) changed.Dispose(); }
}
static class Program {
    [STAThread] static void Main(string[] args) {
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        IslandHost host=null;
        Application.ThreadException+=delegate(object sender,ThreadExceptionEventArgs e) { if(host!=null) host.ReportFailure("ui-thread",e.Exception); else NativeLog.Write("ui-thread",e.Exception); };
        AppDomain.CurrentDomain.UnhandledException+=delegate(object sender,UnhandledExceptionEventArgs e) { NativeLog.Write("fatal",Convert.ToString(e.ExceptionObject)); Environment.Exit(1); };
        TaskScheduler.UnobservedTaskException+=delegate(object sender,UnobservedTaskExceptionEventArgs e) { NativeLog.Write("unobserved-task",e.Exception); e.SetObserved(); };
        try { Run(args,ref host); } catch(Exception ex) { NativeLog.Write("startup",ex); Environment.ExitCode=1; }
    }
    static void Run(string[] args,ref IslandHost host) {
        bool first;
        string profile = Array.IndexOf(args,"--profile") >= 0 ? args[Array.IndexOf(args,"--profile")+1] : Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData)+"\\islandly";
        NativeLog.Profile=Path.GetFullPath(profile);
        // Stable per-profile mutex, without exposing the profile path in a global name.
        byte[] hash=System.Security.Cryptography.SHA256.Create().ComputeHash(Encoding.UTF8.GetBytes(Path.GetFullPath(profile).ToLowerInvariant()));
        using(var mutex=new Mutex(true,"Local\\IslandlyNative-"+BitConverter.ToString(hash).Replace("-",""),out first)) {
            if(!first) return;
            try { Native.SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch(EntryPointNotFoundException) { Native.SetProcessDPIAware(); }
            Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
            host=new IslandHost(args); Application.Run(host);
        }
    }
}
