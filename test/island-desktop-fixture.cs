using System;using System.IO;using System.Drawing;using System.Diagnostics;using System.Runtime.InteropServices;using System.Windows.Forms;
// CI-only foreground app. Not included in the product archive.
static class IslandDesktopFixture {
 [DllImport("user32.dll")]static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]static extern void keybd_event(byte k,byte s,uint f,UIntPtr x);
 sealed class Page:Form {readonly bool light;public Page(bool l){light=l;FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;StartPosition=FormStartPosition.Manual;Text="T24 foreign application";DoubleBuffered=true;}protected override void OnPaint(PaintEventArgs e){e.Graphics.Clear(light?Color.FromArgb(234,239,246):Color.FromArgb(24,32,46));using(var b=new SolidBrush(light?Color.FromArgb(180,196,220):Color.FromArgb(53,72,99)))for(int y=0;y<Height;y+=32)for(int x=0;x<Width;x+=32)if(((x+y)/32)%2==0)e.Graphics.FillRectangle(b,x,y,32,32);}}
 static void Foreground(Form w){var t=Stopwatch.StartNew();do{keybd_event(0x12,0,0,UIntPtr.Zero);keybd_event(0x12,0,2,UIntPtr.Zero);w.Activate();SetForegroundWindow(w.Handle);Application.DoEvents();if(GetForegroundWindow()==w.Handle)return;System.Threading.Thread.Sleep(25);}while(t.ElapsedMilliseconds<3000);throw new Exception("Fixture did not become foreground");}
 [STAThread]static int Main(string[]a){try{using(var page=new Page(a[1]=="light"))using(var backdrop=new Page(a[1]=="light"))using(var tick=new Timer{Interval=50}){
  backdrop.Bounds=Screen.PrimaryScreen.Bounds;backdrop.Show();page.TopMost=true;page.Bounds=Screen.PrimaryScreen.Bounds;string previous="";
  page.Shown+=delegate{Foreground(page);File.WriteAllText(Path.Combine(a[0],"fixture-ready"),page.Handle.ToInt64().ToString());tick.Start();};
  tick.Tick+=delegate{if(backdrop.Bounds!=Screen.PrimaryScreen.Bounds)backdrop.Bounds=Screen.PrimaryScreen.Bounds;string file=Path.Combine(a[0],"fixture-command");if(!File.Exists(file))return;string cmd;using(var f=new FileStream(file,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete))using(var r=new StreamReader(f))cmd=r.ReadToEnd().Trim();if(cmd==""||cmd==previous)return;previous=cmd;if(cmd=="stop"){page.Close();return;}page.Bounds=cmd=="fullscreen"?Screen.PrimaryScreen.Bounds:new Rectangle(40,280,Math.Min(700,Screen.PrimaryScreen.Bounds.Width-80),320);page.Invalidate();Foreground(page);File.WriteAllText(Path.Combine(a[0],"fixture-state"),cmd);};
  Application.Run(page);backdrop.Close();
 }return 0;}catch(Exception e){Console.Error.WriteLine(e);return 1;}}
}
