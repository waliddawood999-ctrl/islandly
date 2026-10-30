using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
static class FullscreenFixture {
 [DllImport("user32.dll")]static extern bool SetForegroundWindow(IntPtr window);
 [STAThread]static int Main(string[]args){try{using(var window=new Form{FormBorderStyle=FormBorderStyle.None,ShowInTaskbar=false,TopMost=true,Bounds=Screen.PrimaryScreen.Bounds,Text="T21 fullscreen regression"})using(var timer=new Timer{Interval=100}){
  window.Shown+=delegate{window.Activate();SetForegroundWindow(window.Handle);File.WriteAllText(Path.Combine(args[0],"fullscreen-ready"),window.Handle.ToInt64().ToString());timer.Start();};
  timer.Tick+=delegate{if(File.Exists(Path.Combine(args[0],"fullscreen-stop")))window.Close();};Application.Run(window);
 }return 0;}catch(Exception ex){Console.Error.WriteLine(ex);return 1;}}
}
