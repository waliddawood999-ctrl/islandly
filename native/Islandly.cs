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
    [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr h, int id, uint mods, uint key);
    [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr h, int id);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool AddClipboardFormatListener(IntPtr h);
    [DllImport("user32.dll")] public static extern bool RemoveClipboardFormatListener(IntPtr h);
    [StructLayout(LayoutKind.Sequential)] public struct LASTINPUT { public uint size,time; }
    [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUT input);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
    [DllImport("advapi32.dll")] public static extern int RegNotifyChangeKeyValue(IntPtr key,bool subtree,uint filter,IntPtr ev,bool async);

    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT rect);
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr window);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern uint RegisterWindowMessage(string name);
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct STARTUPINFO { public int cb; public string reserved, desktop, title; public int x,y,w,h,xChars,yChars,fill,flags; public short show,reservedBytes; public IntPtr reservedPtr,input,output,error; }
    [StructLayout(LayoutKind.Sequential)] public struct PROCESSINFO { public IntPtr process,thread; public int pid,tid; }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool CreateProcess(string app, StringBuilder command, IntPtr pa, IntPtr ta, bool inherit, uint flags, IntPtr environment, string directory, ref STARTUPINFO startup, out PROCESSINFO info);
    [DllImport("kernel32.dll")] public static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr CreateJobObject(IntPtr attrs, string name);
    [DllImport("kernel32.dll")] public static extern bool SetInformationJobObject(IntPtr h, int type, ref EXTENDEDLIMIT data, int len);
    [DllImport("kernel32.dll")] public static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] public static extern bool TerminateJobObject(IntPtr job, uint code);
    [DllImport("kernel32.dll")] public static extern bool QueryInformationJobObject(IntPtr h, int type, IntPtr data, uint size, out uint returned);
    [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
}

sealed class IslandHost : Form {
    readonly string root, electron, profile, probe;
    readonly bool packaged;
    readonly JavaScriptSerializer json = new JavaScriptSerializer();
    readonly System.Windows.Forms.Timer ticker = new System.Windows.Forms.Timer();
    readonly Stopwatch clock = Stopwatch.StartNew();
    readonly Queue<double> latencies = new Queue<double>();
    Dictionary<string,object> settings = new Dictionary<string,object>();
    Dictionary<string,object> state = new Dictionary<string,object>();
    Process child;
    StreamWriter childInput;
    NamedPipeServerStream sessionPipe;
    AnonymousPipeServerStream inputPipe, outputPipe, errorPipe;
    IntPtr job;
    NotifyIcon tray;
    bool ready, bar, closing, hidden, measuring, hoverArmed;
    long launchedAt, readyAt, shutdownAt, hoverAt, stateWrittenAt;
    string lastCommand = "";
    string modeOverride;
    Native.APPBARDATA abd;
    DateTime settingsStamp;
    int launchCount;
    uint taskbarCreated;
    bool barBlocked;
    long lastBackground;
    int breakSeconds;
    readonly List<string> pendingClipboard = new List<string>();
    ConsentWatcher consent;
    string privacyLabel = "";

    public IslandHost(string[] args) {
        packaged = File.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"IslandlyPanels.exe"));
        root = Arg(args,"--root", packaged ? Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"resources/app") : Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"../..")));
        electron = Arg(args,"--electron", packaged ? Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"IslandlyPanels.exe") : Path.Combine(root,"node_modules/electron/dist/electron.exe"));
        profile = Arg(args,"--profile", Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"islandly"));
        probe = Arg(args,"--probe-dir", "");
        modeOverride = Arg(args,"--mode", "");
        Directory.CreateDirectory(profile);
        if (probe != "") { Directory.CreateDirectory(probe); measuring = true; }
        ReadSettings();
        try { state = json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(profile,"native-session.json"))); } catch { }
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
        MouseEnter += delegate { hoverArmed = true; hoverAt = clock.ElapsedMilliseconds; };
        MouseLeave += delegate { hoverArmed = false; };
        MouseClick += delegate(object s, MouseEventArgs e) { if (e.Button == MouseButtons.Left) OpenPanel("expand"); };
        ticker.Interval = 250; ticker.Tick += Tick; ticker.Start();
        FormClosed += delegate { Cleanup(); };
        Microsoft.Win32.SystemEvents.DisplaySettingsChanged += DisplayChanged;
    }
    static string Arg(string[] args, string key, string fallback) { int i = Array.IndexOf(args,key); return i >= 0 && i+1 < args.Length ? args[i+1] : fallback; }
    protected override bool ShowWithoutActivation { get { return true; } }
    protected override CreateParams CreateParams { get { var p = base.CreateParams; p.ExStyle |= 0x08000080; return p; } }
    string Setting(string key, string fallback) { object v; return settings.TryGetValue(key,out v) ? Convert.ToString(v,System.Globalization.CultureInfo.InvariantCulture) : fallback; }
    void ReadSettings() {
        string file = Path.Combine(profile,"settings.json");
        try { var stamp = File.GetLastWriteTimeUtc(file); if (stamp == settingsStamp) return;
            var next = json.Deserialize<Dictionary<string,object>>(File.ReadAllText(file)); settings = next; settingsStamp = stamp;
        } catch { }
    }
    protected override void OnHandleCreated(EventArgs e) {
        base.OnHandleCreated(e);
        Native.RegisterHotKey(Handle,1,0x4003,0x49); // Ctrl Alt I, no repeat
        Native.RegisterHotKey(Handle,2,0x4003,0x20);
        Native.RegisterHotKey(Handle,3,0x4003,0x50);
        Native.RegisterHotKey(Handle,4,0x4003,0x53);
        taskbarCreated=Native.RegisterWindowMessage("TaskbarCreated");
        RecoverBar();
        Native.AddClipboardFormatListener(Handle);
        consent = new ConsentWatcher(delegate(string label) { if(!closing) { privacyLabel = label; Position(); } });
        Position();
    }
    void DisplayChanged(object s, EventArgs e) { if (!closing && IsHandleCreated) BeginInvoke((Action)Position); }
    bool Fullscreen() {
        if (Setting("hideFullscreen","True").Equals("False",StringComparison.OrdinalIgnoreCase)) return false;
        IntPtr h = Native.GetForegroundWindow(); var name = new StringBuilder(128); Native.GetClassName(h,name,128);
        if (h == Handle || name.ToString() == "Progman" || name.ToString() == "WorkerW" || name.ToString() == "Shell_TrayWnd") return false;
        Native.RECT r; if (!Native.GetWindowRect(h,out r)) return false;
        if(Screen.FromHandle(h).DeviceName != TargetScreen().DeviceName) return false;
        var b = Screen.FromHandle(h).Bounds;
        return r.left <= b.Left && r.top <= b.Top && r.right >= b.Right && r.bottom >= b.Bottom;
    }
    void Position() {
        if (closing || !IsHandleCreated) return;
        string mode=modeOverride == "" ? Setting("islandMode","overlay") : modeOverride;
        bool reserved = !barBlocked && (mode == "appbar" || mode == "reserved-bar");
        bool hide = hidden || Fullscreen();
        bool wantBar = reserved && !hide;
        if (wantBar != bar) {
            if (bar) RemoveBar();
            bar = wantBar;
            if (bar) { abd = new Native.APPBARDATA(); abd.cbSize = Marshal.SizeOf(abd); abd.hWnd = Handle; abd.callback = 0x8001; MarkBar(); if(Native.SHAppBarMessage(0,ref abd).ToUInt64() == 0) { bar=false; DeleteBarMarker(); } }
        }
        float scale; if (!Single.TryParse(Setting("scale","0.8"), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture,out scale)) scale = .8f;
        scale = Math.Max(.5f, Math.Min(2f,scale)) * CreateGraphicsDpi();
        var screen = TargetScreen().Bounds;
        if(Setting("micCamIndicator","True") == "False") privacyLabel = "";
        bool sliver = Setting("autoHide","auto") != "never" && !TimerRunning() && privacyLabel == "";
        int w = (int)((sliver ? 84 : 138)*scale), height = Math.Max(4,(int)((sliver ? 5 : 36)*scale));
        if (bar) {
            var previous = abd.rect;
            abd.edge = 1; abd.rect = new Native.RECT { left = screen.Left, top = screen.Top, right = screen.Right, bottom = screen.Top + (int)(44*scale) };
            Native.SHAppBarMessage(2,ref abd); abd.rect.bottom = abd.rect.top + (int)(44*scale); if(previous.left != abd.rect.left || previous.right != abd.rect.right || previous.top != abd.rect.top || previous.bottom != abd.rect.bottom) { MarkBar(); Native.SHAppBarMessage(3,ref abd); }
        }
        string pos = Setting("position","center");
        int x = pos == "left" ? screen.Left+16 : pos == "right" ? screen.Right-w-16 : screen.Left+(screen.Width-w)/2;
        SetBounds(x,screen.Top + (sliver ? 0 : (int)(8*scale)),w,height);
        using (var shape = new GraphicsPath()) { int d = Math.Min(Height,Width); shape.AddArc(0,0,d,d,180,90); shape.AddArc(Width-d,0,d,d,270,90); shape.AddArc(Width-d,Height-d,d,d,0,90); shape.AddArc(0,Height-d,d,d,90,90); shape.CloseFigure(); var old = Region; Region = new Region(shape); if(old != null) old.Dispose(); }
        Visible = !hide && !ready; Invalidate();
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
    protected override void OnPaint(PaintEventArgs e) {
        base.OnPaint(e); e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        if (Height < 12) { using(var brush=new SolidBrush(TimerRunning() ? Color.FromArgb(167,139,250) : Color.FromArgb(76,76,76))) e.Graphics.FillRectangle(brush,ClientRectangle); return; }
        using(var gradient=new LinearGradientBrush(ClientRectangle,Color.FromArgb(12,12,16),Color.Black,90f)) e.Graphics.FillRectangle(gradient,ClientRectangle);
        string label = DateTime.Now.ToString("HH:mm");
        if (TimerRunning()) { long end = Convert.ToInt64(state["endAt"]); var left = Math.Max(0,(end-DateTimeOffset.UtcNow.ToUnixTimeMilliseconds())/1000); label = (left/60).ToString("00")+":"+(left%60).ToString("00"); }
        if(privacyLabel != "") label = privacyLabel;
        else if(!TimerRunning() && SystemInformation.PowerStatus.BatteryChargeStatus != BatteryChargeStatus.NoSystemBattery && SystemInformation.PowerStatus.BatteryLifePercent < .2f) label = ((int)(SystemInformation.PowerStatus.BatteryLifePercent*100))+"%";
        using(var brush = new SolidBrush(Color.FromArgb(167,139,250))) e.Graphics.FillEllipse(brush,Width*.16f,Height*.42f,Height*.16f,Height*.16f);
        using(var font = new Font("Segoe UI",Math.Max(8,Height*.32f),FontStyle.Regular,GraphicsUnit.Pixel)) TextRenderer.DrawText(e.Graphics,label,font,new Rectangle((int)(Width*.2f),0,(int)(Width*.7f),Height),ForeColor,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter);
    }
    bool TimerRunning() { object running; return state.TryGetValue("running",out running) && running is bool && (bool)running; }
    void OpenPanel(string command) {
        hoverArmed = false;
        if (child != null) { if (ready) Send(command); return; }
        if (!File.Exists(electron)) { tray.ShowBalloonTip(5000,"Islandly","Panel runtime missing. Run npm ci or reinstall the full package.",ToolTipIcon.Error); return; }
        launchedAt = clock.ElapsedMilliseconds;
        job = Native.CreateJobObject(IntPtr.Zero,null);
        var limit = new Native.EXTENDEDLIMIT(); limit.basic.flags = 0x2000; // KILL_ON_JOB_CLOSE
        if (job == IntPtr.Zero || !Native.SetInformationJobObject(job,9,ref limit,Marshal.SizeOf(limit))) throw new Exception("Cannot contain panel process tree");
        // Suspend before assigning the job: not even early Chromium children can escape ownership.
        string pipeName="Islandly-"+Guid.NewGuid().ToString("N");
        var security=new PipeSecurity(); security.AddAccessRule(new PipeAccessRule(WindowsIdentity.GetCurrent().User,PipeAccessRights.FullControl,AccessControlType.Allow));
        sessionPipe=new NamedPipeServerStream(pipeName,PipeDirection.InOut,1,PipeTransmissionMode.Byte,PipeOptions.Asynchronous,65536,65536,security);
        var pipe=sessionPipe;
        pipe.BeginWaitForConnection(delegate(IAsyncResult result) {
            try { pipe.EndWaitForConnection(result); if(closing || pipe != sessionPipe) return;
                BeginInvoke((Action)(() => { if(closing || pipe != sessionPipe) return; childInput=new StreamWriter(pipe,new UTF8Encoding(false)); childInput.AutoFlush=true; ReadSession(pipe); }));
            } catch(ObjectDisposedException) {} catch(IOException) {}
        },null);
        inputPipe = new AnonymousPipeServerStream(PipeDirection.Out,HandleInheritability.Inheritable);
        outputPipe = new AnonymousPipeServerStream(PipeDirection.In,HandleInheritability.Inheritable);
        errorPipe = new AnonymousPipeServerStream(PipeDirection.In,HandleInheritability.Inheritable);
        var startup = new Native.STARTUPINFO(); startup.cb = Marshal.SizeOf(startup); startup.flags = 0x100;
        startup.input = new IntPtr(Int64.Parse(inputPipe.GetClientHandleAsString()));
        startup.output = new IntPtr(Int64.Parse(outputPipe.GetClientHandleAsString()));
        startup.error = new IntPtr(Int64.Parse(errorPipe.GetClientHandleAsString()));
        var environment = new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);
        foreach(DictionaryEntry entry in Environment.GetEnvironmentVariables()) environment[(string)entry.Key] = (string)entry.Value;
        environment["ISLANDLY_NATIVE_PIPE"] = pipeName;
        environment["ISLANDLY_NATIVE_SESSION"] = "1"; environment["ISLANDLY_NATIVE_PROFILE"] = profile; environment["ISLANDLY_NATIVE_COMMAND"] = command;
        if(probe != "") environment["ISLANDLY_NATIVE_PROBE"] = "1";
        string block = String.Join("\0",environment.Select(pair => pair.Key+"="+pair.Value))+"\0\0";
        IntPtr env = Marshal.StringToHGlobalUni(block);
        Native.PROCESSINFO pi;
        bool started;
        try { started = Native.CreateProcess(electron,new StringBuilder("\""+electron+"\""+(packaged ? "" : " \""+root+"\"")),IntPtr.Zero,IntPtr.Zero,true,0x08000404,env,root,ref startup,out pi); }
        finally { Marshal.FreeHGlobal(env); }
        if(!started) { EndSession(); throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()); }
        ready = false; shutdownAt = 0; lastCommand = command;
        try {
            if(!Native.AssignProcessToJobObject(job,pi.process)) throw new Exception("Panel job assignment failed");
            child = Process.GetProcessById(pi.pid);
            inputPipe.DisposeLocalCopyOfClientHandle(); outputPipe.DisposeLocalCopyOfClientHandle(); errorPipe.DisposeLocalCopyOfClientHandle();

            ReadPipe(outputPipe,false); ReadPipe(errorPipe,true);
            if(Native.ResumeThread(pi.thread) == UInt32.MaxValue) throw new Exception("Panel resume failed");
        } catch { try { Process.GetProcessById(pi.pid).Kill(); } catch {} EndSession(); throw; }
        finally { Native.CloseHandle(pi.thread); Native.CloseHandle(pi.process); }
        launchCount++;
        Status();
    }
    async void ReadSession(NamedPipeServerStream pipe) {
        try { using(var reader=new StreamReader(pipe,Encoding.UTF8)) {
            string line; while((line=await reader.ReadLineAsync()) != null) {
                if(closing || pipe != sessionPipe) return;
                if(line.StartsWith("ISLANDLY:")) Message(line);
            }
        } } catch(ObjectDisposedException) {} catch(IOException) {}
    }
    async void ReadPipe(AnonymousPipeServerStream pipe, bool error) {
        try { using(var reader = new StreamReader(pipe,Encoding.UTF8)) {
            string line;
            while((line = await reader.ReadLineAsync()) != null) {
                if(closing || (error ? errorPipe : outputPipe) != pipe) return;
                if(!error && line.StartsWith("ISLANDLY:")) Message(line);
                else if(error) File.AppendAllText(Path.Combine(profile,"native-panels.log"),line+Environment.NewLine);
            }
        } } catch(ObjectDisposedException) {} catch(IOException) {}
    }
    void Send(string command) { try { if(childInput != null) childInput.WriteLine(command); } catch {} }
    void Message(string line) {
        if(child == null) return;
        if(line == "ISLANDLY:ready:") { ready = true; readyAt = clock.ElapsedMilliseconds; latencies.Enqueue(readyAt-launchedAt); Position(); Status(); }
        if(line == "ISLANDLY:idle:") { shutdownAt = clock.ElapsedMilliseconds; }
        if(line == "ISLANDLY:restart:") { EndSession(); OpenPanel("settings"); return; }
        if(line == "ISLANDLY:exit:") { Close(); return; }
        if(line.StartsWith("ISLANDLY:state:")) {
            pendingClipboard.Clear();
            try { state = json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(Convert.FromBase64String(line.Substring(15))));
                SaveState();
            } catch {} // invalid child data never becomes a command
        }
    }
    void SaveState() { string file = Path.Combine(profile,"native-session.json"); File.WriteAllText(file+".tmp",json.Serialize(state)); if(File.Exists(file)) File.Replace(file+".tmp",file,null); else File.Move(file+".tmp",file); stateWrittenAt = clock.ElapsedMilliseconds; }
    void EndSession() {
        ready = false;
        if(job != IntPtr.Zero) { Native.TerminateJobObject(job,0); Native.CloseHandle(job); job = IntPtr.Zero; }
        if(child != null) { child.Dispose(); child = null; }
        if(childInput != null) { childInput.Dispose(); childInput = null; }
        if(sessionPipe != null) { sessionPipe.Dispose(); sessionPipe=null; }
        if(inputPipe != null) { inputPipe.Dispose(); inputPipe = null; }
        if(outputPipe != null) { outputPipe.Dispose(); outputPipe = null; }
        if(errorPipe != null) { errorPipe.Dispose(); errorPipe = null; }
        shutdownAt = 0; Position(); Status();
    }
    void Tick(object sender, EventArgs e) {
        ReadSettings();
        if(clock.ElapsedMilliseconds-lastBackground >= 5000) { lastBackground=clock.ElapsedMilliseconds; if(child == null) BackgroundTick(); }
        if(child != null && (child.HasExited || shutdownAt > 0 && clock.ElapsedMilliseconds-shutdownAt > 1500 || !ready && clock.ElapsedMilliseconds-launchedAt > 30000)) EndSession();
        if(hoverArmed && !measuring && clock.ElapsedMilliseconds-hoverAt >= 280) OpenPanel("expand");
        if(TimerRunning() && Convert.ToInt64(state["endAt"]) <= DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() && child == null) {
            state["running"] = false; state["remaining"] = 0; state["completed"] = true; SaveState();
            System.Media.SystemSounds.Asterisk.Play(); tray.ShowBalloonTip(5000,"Islandly","Timer complete",ToolTipIcon.Info);
        }
        Position();
        if(probe != "") {
            string commandFile = Path.Combine(probe,"command.txt");
            if(File.Exists(commandFile)) { string command = File.ReadAllText(commandFile).Trim(); File.Delete(commandFile);
                if(command == "measure") measuring = true;
                else if(command == "exit") Close();
                else if(command == "close") Send("close");
                else if(new[]{"expand","settings","palette","pomodoro"}.Contains(command)) OpenPanel(command);
            }
            Status();
        }
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
        var processes = new List<object>(); double total = 0;
        foreach(int id in ids) try { using(var p=Process.GetProcessById(id)) { double mb=p.WorkingSet64/1048576.0; total+=mb; processes.Add(new { pid=id, name=p.ProcessName, mb=mb }); } } catch(ArgumentException) {}
        var data = new { hostPid=Process.GetCurrentProcess().Id, phase=child == null ? "idle" : ready ? "panel" : "starting", averageNotApplicable=true, totalMB=total, processes=processes, launchCount=launchCount, latenciesMs=latencies.ToArray(), appBar=bar, appBarTop=abd.rect.top, appBarBottom=abd.rect.bottom, stateAgeMs=clock.ElapsedMilliseconds-stateWrittenAt, command=lastCommand };
        string file=Path.Combine(probe,"status.json"); try { File.WriteAllText(file+".tmp",json.Serialize(data)); if(File.Exists(file)) File.Replace(file+".tmp",file,null); else File.Move(file+".tmp",file); } catch(IOException) {}
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
    void BackgroundTick() {
        var input=new Native.LASTINPUT(); input.size=(uint)Marshal.SizeOf(input);
        bool active=Native.GetLastInputInfo(ref input) && unchecked((uint)Environment.TickCount-input.time)<60000;
        if(Setting("timeTracking","True") != "False" && Setting("ecoMode","False") != "True" && active) {
            try {
                uint pid; Native.GetWindowThreadProcessId(Native.GetForegroundWindow(),out pid);
                string name; using(var p=Process.GetProcessById((int)pid)) name=p.ProcessName;
                string[] skip={"Islandly","IslandlyPanels","electron","LockApp","SearchHost","ShellExperienceHost","StartMenuExperienceHost","TextInputHost"};
                if(!skip.Contains(name,StringComparer.OrdinalIgnoreCase)) {
                    string file=Path.Combine(profile,"usage.json"); Dictionary<string,object> usage;
                    try { usage=json.Deserialize<Dictionary<string,object>>(File.ReadAllText(file)); } catch { usage=new Dictionary<string,object>(); }
                    string day=DateTime.Now.ToString("yyyy-MM-dd"); object data;
                    var counts=usage.TryGetValue(day,out data) ? data as Dictionary<string,object> : null;
                    if(counts == null) { counts=new Dictionary<string,object>(); usage[day]=counts; }
                    object seconds; counts[name]=(counts.TryGetValue(name,out seconds)?Convert.ToInt32(seconds):0)+5;
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
        if(taskbarCreated != 0 && m.Msg == taskbarCreated) { bar=false; DeleteBarMarker(); Position(); }
        if(m.Msg == 0x031D && child == null && Setting("clipboard","True") != "False") {
            try { if(Clipboard.ContainsText()) { string text=Clipboard.GetText(); if(text.Length > 5000) text=text.Substring(0,5000);
                if(text != "") { pendingClipboard.Remove(text); pendingClipboard.Add(text); while(pendingClipboard.Count > 30) pendingClipboard.RemoveAt(0); state["clipboardPending"]=pendingClipboard.ToArray(); SaveState(); }
            } } catch(System.Runtime.InteropServices.ExternalException) {}
        }
        if(m.Msg == 0x0312) { int id=m.WParam.ToInt32(); OpenPanel(id==2?"palette":id==3?"pomodoro":id==4?"stash":"expand"); }
        if(m.Msg == 0x8001 && m.WParam.ToInt32() == 1) BeginInvoke((Action)Position);
        base.WndProc(ref m);
    }
    void Cleanup() {
        if(closing) return; closing=true; ticker.Stop();
        Microsoft.Win32.SystemEvents.DisplaySettingsChanged -= DisplayChanged;
        if(bar) { RemoveBar(); bar=false; }
        for(int i=1;i<=4;i++) Native.UnregisterHotKey(Handle,i);
        Native.RemoveClipboardFormatListener(Handle); if(consent != null) consent.Dispose();
        Send("quit"); EndSession(); tray.Visible=false; tray.Dispose(); ticker.Dispose();
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
        bool first;
        string profile = Array.IndexOf(args,"--profile") >= 0 ? args[Array.IndexOf(args,"--profile")+1] : Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData)+"\\islandly";
        // Stable per-profile mutex, without exposing the profile path in a global name.
        byte[] hash=System.Security.Cryptography.SHA256.Create().ComputeHash(Encoding.UTF8.GetBytes(Path.GetFullPath(profile).ToLowerInvariant()));
        using(var mutex=new Mutex(true,"Local\\IslandlyNative-"+BitConverter.ToString(hash).Replace("-",""),out first)) {
            if(!first) return;
            try { Native.SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch(EntryPointNotFoundException) { Native.SetProcessDPIAware(); }
            Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new IslandHost(args));
        }
    }
}
