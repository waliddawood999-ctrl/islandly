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
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT rect);
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
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
    public IslandHost(string[] args) {
        packaged = File.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"IslandlyPanels.exe"));
        root = Arg(args,"--root", packaged ? Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"resources/app") : Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"../.."))));
        electron = Arg(args,"--electron", packaged ? Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"IslandlyPanels.exe") : Path.Combine(root,"node_modules/electron/dist/electron.exe"));
        profile = Arg(args,"--profile", Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"islandly"));
        probe = Arg(args,"--probe-dir", "");
        modeOverride = Arg(args,"--mode", "");
        Directory.CreateDirectory(profile);
        if (probe != "") Directory.CreateDirectory(probe);
        ReadSettings();
        try { state = json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(profile,"native-session.json"))); } catch { }
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
        Position();
    }
    void DisplayChanged(object s, EventArgs e) { if (!closing && IsHandleCreated) BeginInvoke((Action)Position); }
    bool Fullscreen() {
        if (Setting("hideFullscreen","True").Equals("False",StringComparison.OrdinalIgnoreCase)) return false;
        IntPtr h = Native.GetForegroundWindow(); var name = new StringBuilder(128); Native.GetClassName(h,name,128);
        if (h == Handle || name.ToString() == "Progman" || name.ToString() == "WorkerW" || name.ToString() == "Shell_TrayWnd") return false;
        Native.RECT r; if (!Native.GetWindowRect(h,out r)) return false;
        var b = Screen.FromHandle(h).Bounds;
        return r.left <= b.Left && r.top <= b.Top && r.right >= b.Right && r.bottom >= b.Bottom;
    }
    void Position() {
        if (closing || !IsHandleCreated) return;
        bool reserved = (modeOverride == "" ? Setting("islandMode","overlay") : modeOverride) == "reserved-bar";
        bool hide = hidden || Fullscreen();
        bool wantBar = reserved && !hide;
        if (wantBar != bar) {
            if (bar) Native.SHAppBarMessage(1,ref abd);
            bar = wantBar;
            if (bar) { abd = new Native.APPBARDATA(); abd.cbSize = Marshal.SizeOf(abd); abd.hWnd = Handle; abd.callback = 0x8001; Native.SHAppBarMessage(0,ref abd); }
        }
        float scale; if (!Single.TryParse(Setting("scale","0.8"), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture,out scale)) scale = .8f;
        scale = Math.Max(.5f, Math.Min(2f,scale)) * CreateGraphicsDpi();
        var screen = Screen.PrimaryScreen.Bounds;
        bool sliver = Setting("autoHide","auto") != "never" && !TimerRunning();
        int w = (int)((sliver ? 84 : 138)*scale), height = Math.Max(4,(int)((sliver ? 5 : 36)*scale));
        if (bar) {
            var previous = abd.rect;
            abd.edge = 1; abd.rect = new Native.RECT { left = screen.Left, top = screen.Top, right = screen.Right, bottom = screen.Top + (int)(44*scale) };
            Native.SHAppBarMessage(2,ref abd); abd.rect.bottom = abd.rect.top + (int)(44*scale); if(previous.left != abd.rect.left || previous.right != abd.rect.right || previous.top != abd.rect.top || previous.bottom != abd.rect.bottom) Native.SHAppBarMessage(3,ref abd);
        }
        string pos = Setting("position","center");
        int x = pos == "left" ? screen.Left+16 : pos == "right" ? screen.Right-w-16 : screen.Left+(screen.Width-w)/2;
        SetBounds(x,screen.Top + (sliver ? 0 : (int)(8*scale)),w,height);
        using (var shape = new GraphicsPath()) { int d = Math.Min(Height,Width); shape.AddArc(0,0,d,d,180,90); shape.AddArc(Width-d,0,d,d,270,90); shape.AddArc(Width-d,Height-d,d,d,0,90); shape.AddArc(0,Height-d,d,d,90,90); shape.CloseFigure(); var old = Region; Region = new Region(shape); if(old != null) old.Dispose(); }
        Visible = !hide && !ready; Invalidate();
    }
    float CreateGraphicsDpi() { using(var g = CreateGraphics()) return g.DpiX/96f; }
    protected override void OnPaint(PaintEventArgs e) {
        base.OnPaint(e); e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        if (Height < 12) return;
        string label = DateTime.Now.ToString("HH:mm");
        if (TimerRunning()) { long end = Convert.ToInt64(state["endAt"]); var left = Math.Max(0,(end-DateTimeOffset.UtcNow.ToUnixTimeMilliseconds())/1000); label = (left/60).ToString("00")+":"+(left%60).ToString("00"); }
        using(var brush = new SolidBrush(Color.FromArgb(167,139,250))) e.Graphics.FillEllipse(brush,Width*.16f,Height*.42f,Height*.16f,Height*.16f);
        using(var font = new Font("Segoe UI",Math.Max(8,Height*.32f),FontStyle.Regular,GraphicsUnit.Pixel)) TextRenderer.DrawText(e.Graphics,label,font,new Rectangle((int)(Width*.2f),0,(int)(Width*.7f),Height),ForeColor,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter);
    }
    bool TimerRunning() { object running; return state.TryGetValue("running",out running) && running is bool && (bool)running; }
    void OpenPanel(string command) {
        hoverArmed = false;
        if (child != null) { if (ready) Send(command); return; }
        if (!File.Exists(electron)) { tray.ShowBalloonTip(5000,"Islandly","Panel runtime missing. Run npm ci or reinstall the full package.",ToolTipIcon.Error); return; }
        job = Native.CreateJobObject(IntPtr.Zero,null);
        var limit = new Native.EXTENDEDLIMIT(); limit.basic.flags = 0x2000; // KILL_ON_JOB_CLOSE
        if (job == IntPtr.Zero || !Native.SetInformationJobObject(job,9,ref limit,Marshal.SizeOf(limit))) throw new Exception("Cannot contain panel process tree");
        // Suspend before assigning the job: not even early Chromium children can escape ownership.
        inputPipe = new AnonymousPipeServerStream(PipeDirection.Out,HandleInheritability.Inheritable);
        outputPipe = new AnonymousPipeServerStream(PipeDirection.In,HandleInheritability.Inheritable);
        errorPipe = new AnonymousPipeServerStream(PipeDirection.In,HandleInheritability.Inheritable);
        var startup = new Native.STARTUPINFO(); startup.cb = Marshal.SizeOf(startup); startup.flags = 0x100;
        startup.input = new IntPtr(Int64.Parse(inputPipe.GetClientHandleAsString()));
        startup.output = new IntPtr(Int64.Parse(outputPipe.GetClientHandleAsString()));
        startup.error = new IntPtr(Int64.Parse(errorPipe.GetClientHandleAsString()));
        var environment = new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);
        foreach(DictionaryEntry entry in Environment.GetEnvironmentVariables()) environment[(string)entry.Key] = (string)entry.Value;
        environment["ISLANDLY_NATIVE_SESSION"] = "1"; environment["ISLANDLY_NATIVE_PROFILE"] = profile; environment["ISLANDLY_NATIVE_COMMAND"] = command;
        if(probe != "") environment["ISLANDLY_NATIVE_PROBE"] = "1";
        string block = String.Join("\0",environment.Select(pair => pair.Key+"="+pair.Value))+"\0\0";
        IntPtr env = Marshal.StringToHGlobalUni(block);
        Native.PROCESSINFO pi;
        bool started;
        try { started = Native.CreateProcess(electron,new StringBuilder("\""+electron+"\""+(packaged ? "" : " \""+root+"\"")),IntPtr.Zero,IntPtr.Zero,true,0x08000404,env,root,ref startup,out pi); }
        finally { Marshal.FreeHGlobal(env); }
        if(!started) { EndSession(); throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()); }
        launchedAt = clock.ElapsedMilliseconds; ready = false; shutdownAt = 0; lastCommand = command;
        try {
            if(!Native.AssignProcessToJobObject(job,pi.process)) throw new Exception("Panel job assignment failed");
            child = Process.GetProcessById(pi.pid);
            inputPipe.DisposeLocalCopyOfClientHandle(); outputPipe.DisposeLocalCopyOfClientHandle(); errorPipe.DisposeLocalCopyOfClientHandle();
            childInput = new StreamWriter(inputPipe,new UTF8Encoding(false)); childInput.AutoFlush = true;
            ReadPipe(outputPipe,false); ReadPipe(errorPipe,true);
            if(Native.ResumeThread(pi.thread) == UInt32.MaxValue) throw new Exception("Panel resume failed");
        } catch { try { Process.GetProcessById(pi.pid).Kill(); } catch {} EndSession(); throw; }
        finally { Native.CloseHandle(pi.thread); Native.CloseHandle(pi.process); }
        launchCount++;
        Status();
    }
    async void ReadPipe(AnonymousPipeServerStream pipe, bool error) {
        try { using(var reader = new StreamReader(pipe,Encoding.UTF8)) {
            string line;
            while((line = await reader.ReadLineAsync()) != null) {
                if(closing) return;
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
        if(inputPipe != null) { inputPipe.Dispose(); inputPipe = null; }
        if(outputPipe != null) { outputPipe.Dispose(); outputPipe = null; }
        if(errorPipe != null) { errorPipe.Dispose(); errorPipe = null; }
        shutdownAt = 0; Position(); Status();
    }
    void Tick(object sender, EventArgs e) {
        ReadSettings();
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
    void ToggleStartup() {
        using(var key=Microsoft.Win32.Registry.CurrentUser.CreateSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Run")) {
            if(key.GetValue("Islandly") != null) key.DeleteValue("Islandly");
            else key.SetValue("Islandly","\""+Application.ExecutablePath+"\""+(packaged ? "" : " --root \""+root+"\""));
        }
    }
    protected override void WndProc(ref Message m) {
        if(m.Msg == 0x0312) { int id=m.WParam.ToInt32(); OpenPanel(id==2?"palette":id==3?"pomodoro":id==4?"stash":"expand"); }
        if(m.Msg == 0x8001 && m.WParam.ToInt32() == 1) BeginInvoke((Action)Position);
        base.WndProc(ref m);
    }
    void Cleanup() {
        if(closing) return; closing=true; ticker.Stop();
        Microsoft.Win32.SystemEvents.DisplaySettingsChanged -= DisplayChanged;
        if(bar) { Native.SHAppBarMessage(1,ref abd); bar=false; }
        for(int i=1;i<=4;i++) Native.UnregisterHotKey(Handle,i);
        Send("quit"); EndSession(); tray.Visible=false; tray.Dispose(); ticker.Dispose();
    }
}
static class Program {
    [STAThread] static void Main(string[] args) {
        bool first;
        string profile = Array.IndexOf(args,"--profile") >= 0 ? args[Array.IndexOf(args,"--profile")+1] : Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData)+"\\islandly";
        // Stable per-profile mutex, without exposing the profile path in a global name.
        byte[] hash=System.Security.Cryptography.SHA256.Create().ComputeHash(Encoding.UTF8.GetBytes(Path.GetFullPath(profile).ToLowerInvariant()));
        using(var mutex=new Mutex(true,"Local\\IslandlyNative-"+BitConverter.ToString(hash).Replace("-",""),out first)) {
            if(!first) return;
            Native.SetProcessDPIAware(); Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new IslandHost(args));
        }
    }
}
