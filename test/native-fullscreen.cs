using System;
using System.IO;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;
static class FullscreenFixture {
 [DllImport("user32.dll")]static extern bool SetForegroundWindow(IntPtr window);
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
 // Announces readiness only once the window really is the foreground window: a fullscreen foreground app is what the host must react to.
 static bool TakeForeground(Form window,int milliseconds){var clock=Stopwatch.StartNew();while(clock.ElapsedMilliseconds<milliseconds){
   keybd_event(0x12,0,0,UIntPtr.Zero);keybd_event(0x12,0,2,UIntPtr.Zero); // a synthetic Alt press lifts the foreground lock for this process
   window.Activate();SetForegroundWindow(window.Handle);Application.DoEvents();
   if(GetForegroundWindow()==window.Handle)return true;System.Threading.Thread.Sleep(50);}
  return GetForegroundWindow()==window.Handle;}
 [STAThread]static int Main(string[]args){try{using(var window=new Form{FormBorderStyle=FormBorderStyle.None,StartPosition=FormStartPosition.Manual,ShowInTaskbar=false,TopMost=true,Bounds=Screen.PrimaryScreen.Bounds,Text="T21 fullscreen regression"})using(var timer=new Timer{Interval=100}){
  window.Shown+=delegate{window.Bounds=Screen.PrimaryScreen.Bounds;
   if(TakeForeground(window,3000)){File.WriteAllText(Path.Combine(args[0],"fullscreen-ready"),window.Handle.ToInt64().ToString());}
   else File.WriteAllText(Path.Combine(args[0],"fullscreen-not-foreground"),window.Handle.ToInt64()+" foreground="+GetForegroundWindow().ToInt64());
   timer.Start();};
  timer.Tick+=delegate{if(File.Exists(Path.Combine(args[0],"fullscreen-stop")))window.Close();};Application.Run(window);
 }return 0;}catch(Exception ex){Console.Error.WriteLine(ex);return 1;}}
}
