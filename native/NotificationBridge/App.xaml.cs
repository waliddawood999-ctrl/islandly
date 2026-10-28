using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.UI.Notifications;
using Windows.UI.Notifications.Management;

namespace Islandly.NotificationBridge;
public partial class App : Application
{
    private Window? window;
    private UserNotificationListener? listener;
    private HashSet<uint> seen = new();
    private bool reading;
    private bool again;
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetCurrentPackageFullName(ref uint length, System.Text.StringBuilder? name);
    public App() { InitializeComponent(); }
    private static void Emit(object value)
    {
        // Notification text is passed to the parent process only; no file logging.
        try { Console.Out.WriteLine(JsonSerializer.Serialize(value)); Console.Out.Flush(); } catch { }
    }
    protected override async void OnLaunched(LaunchActivatedEventArgs args)
    {
        uint size = 0;
        if (GetCurrentPackageFullName(ref size, null) == 15700)
        { Emit(new { type = "status", status = "package-required" }); Exit(); return; }
        window = new Window { Title = "Islandly — Notification access" };
        var text = new TextBlock { Text = "Allow Islandly to read notification titles and text locally. This does not suppress Windows banners.\nالسماح بقراءة الإشعارات محليًا لا يمنع إشعارات Windows الأصلية.", TextWrapping = TextWrapping.Wrap };
        var allow = new Button { Content = "Request access / طلب الإذن" };
        var cancel = new Button { Content = "Cancel / إلغاء" };
        var panel = new StackPanel { Spacing = 16, Padding = new Thickness(24) };
        panel.Children.Add(text); panel.Children.Add(allow); panel.Children.Add(cancel); window.Content = panel;
        cancel.Click += (_, _) => { Emit(new { type = "status", status = "denied" }); window.Close(); Exit(); };
        allow.Click += async (_, _) => { allow.IsEnabled = false; await Connect(true); allow.IsEnabled = true; };
        window.Closed += (_, _) => { if (listener == null) Exit(); };
        listener = UserNotificationListener.Current;
        if (listener.GetAccessStatus() == UserNotificationListenerAccessStatus.Allowed) await Connect(false);
        else { listener = null; window.AppWindow.Resize(new Windows.Graphics.SizeInt32(500, 280)); window.Activate(); }
    }
    private async Task Connect(bool request)
    {
        try
        {
            listener = UserNotificationListener.Current;
            var status = request ? await listener.RequestAccessAsync() : listener.GetAccessStatus();
            if (status != UserNotificationListenerAccessStatus.Allowed)
            { listener = null; Emit(new { type = "status", status = "denied" }); return; }
            var existing = await listener.GetNotificationsAsync(NotificationKinds.Toast);
            seen = existing.Select(n => n.Id).ToHashSet(); // Do not replay notification history on activation.
            listener.NotificationChanged += (_, _) => window?.DispatcherQueue.TryEnqueue(async () => await Refresh());
            Emit(new { type = "status", status = "allowed" });
            window?.AppWindow.Hide();
        }
        catch (Exception ex) { Emit(new { type = "status", status = "unavailable", error = ex.HResult }); listener = null; window?.Activate(); }
    }
    private async Task Refresh()
    {
        if (reading) { again = true; return; }
        reading = true;
        try
        {
            do
            {
                again = false;
                if (listener == null || listener.GetAccessStatus() != UserNotificationListenerAccessStatus.Allowed)
                { Emit(new { type = "status", status = "denied" }); return; }
                var notifications = await listener.GetNotificationsAsync(NotificationKinds.Toast);
                foreach (var n in notifications.Where(n => !seen.Contains(n.Id)))
                {
                    var elements = n.Notification.Visual.GetBinding(KnownNotificationBindings.ToastGeneric)?.GetTextElements();
                    if (elements == null || elements.Count == 0) continue;
                    Emit(new { type = "notification", source = n.AppInfo.DisplayInfo.DisplayName,
                        title = elements[0].Text, body = string.Join("\n", elements.Skip(1).Select(t => t.Text)) });
                }
                seen = notifications.Select(n => n.Id).ToHashSet();
            } while (again);
        }
        catch (Exception ex) { Emit(new { type = "status", status = "unavailable", error = ex.HResult }); }
        finally { reading = false; }
    }
}
