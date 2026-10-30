# تثبيت Islandly / Install Islandly

## العربية

1. نزّل `Islandly-install-win64.zip` وفكّه كاملًا إلى مجلد عادي. لا تشغّل من داخل ZIP.
2. أغلق أي نسخة تعمل من Islandly من قائمة الأيقونة بجانب الساعة.
3. في المجلد المفكوك اكتب `cmd` في شريط عنوان مستكشف الملفات واضغط Enter، ثم اكتب `Install.cmd`. لا تشغّل كمسؤول. يثبت إلى `%LOCALAPPDATA%\Islandly` ويضيف اختصار `Islandly` إلى قائمة ابدأ وإدخالًا في التطبيقات المثبتة.
4. اختر Y للتشغيل مع Windows أو N لتركه معطلًا. يمكن لاحقًا تشغيل `Install.cmd /startup-on` أو `/startup-off` من الحزمة المفكوكة.
5. افتح Islandly من قائمة ابدأ. يمكنك حذف مجلد ZIP المفكوك بعد التثبيت.

**التحديث:** أغلق Islandly، فك الحزمة الجديدة وشغّل `Install.cmd` من Command Prompt كما سبق. تبقى الإعدادات والسجلات في `%APPDATA%\islandly`، ويبقى اختيار التشغيل مع Windows كما هو إذا اخترت N.

**الإزالة:** من التطبيقات المثبتة اختر Islandly ثم إزالة، أو افتح `%LOCALAPPDATA%\Islandly\Uninstall.cmd /uninstall`. أكّد Y لحذف التطبيق والإعدادات والسجلات والاختصار والتشغيل التلقائي. الإزالة تحذف بيانات النسخ المحمولة التي تستخدم ملف المستخدم الافتراضي نفسه أيضًا؛ انقل نسخة احتياطية قبل التأكيد إذا أردت الاحتفاظ بها.

**Smart App Control:** لا تعطّله. لا تستخدم تجاوز سياسة التنفيذ أو إزالة علامة تنزيل الملفات. هذه الحزمة لا تضيف EXE/DLL للمثبّت ولا تغير بصمات ملفات التطبيق. إذا منع Windows التثبيت أو التشغيل، توقف واحتفظ برسالة الحظر وسجل CodeIntegrity. القبول السابق لبصمة لا يضمن القبول على كل جهاز. مضيف T21 ومكتبة الحركة لم يثبت قبولهما على الجهاز بعد؛ راجع `IDENTITY.json` قبل الاختبار. Windows CI يختبر التثبيت والأداء، لكنه ليس اختبار SAC على جهازك.

## English

1. Download and fully extract `Islandly-install-win64.zip` to an ordinary folder. Do not run inside the ZIP.
2. Quit any running Islandly instance using its tray menu.
3. In the extracted folder, type `cmd` in File Explorer’s address bar and press Enter. Then type `Install.cmd`. Do not run as administrator. It installs into `%LOCALAPPDATA%\Islandly`, adds a Start menu shortcut and an Installed Apps entry.
4. Choose Y to start with Windows or N to leave startup unchanged (off on a new install). Later use `Install.cmd /startup-on` or `/startup-off` from the extracted package.
5. Launch Islandly from Start. The extracted download can then be deleted.

**Update:** quit Islandly, extract the new package and run `Install.cmd` from Command Prompt as above. Settings/logs in `%APPDATA%\islandly` survive. Choosing N leaves the existing startup preference unchanged.

**Uninstall:** use Windows Installed Apps, or run `"%LOCALAPPDATA%\Islandly\Uninstall.cmd" /uninstall` from Command Prompt. Confirm Y to remove the app, settings, logs, shortcut and startup registration. This also removes data used by portable copies sharing the default profile; back it up first if needed.

**SAC:** leave Smart App Control enabled. Do not bypass execution policy or strip download marks. No installer EXE/DLL is added; application binary bytes are copied unchanged. Stop and retain the policy error and CodeIntegrity events if Windows blocks anything. Historical reputation is not a universal acceptance guarantee. T21's host and motion DLL are not laptop-validated identities yet; see `IDENTITY.json`. Windows Server CI does not enforce consumer SAC and cannot certify its acceptance.

## Automation and limits

`Install.cmd /quiet` installs/updates without a startup prompt; startup remains unchanged. `Uninstall.cmd /uninstall /quiet` explicitly deletes all default-profile data. Close the application first. No administrator rights, service, scheduled task, background updater, Electron prewarm or new resident process is introduced. The release is a single offline ZIP; the frozen 250MB Electron executable makes a sub-100MB ZIP a best-effort goal, not a guarantee.

The source is fixed to T21 `5d06d5e`. Its host and `Islandly.Motion.dll` necessarily differ from the laptop-accepted T18 C7A5 host: T21 implements native motion via this DLL. T22 does not rebuild different source, sign, stamp, rename or patch either binary. Returning to the T18 executable would drop T20/T21 fixes and motion, so it is not silently substituted. The Electron hash must remain `758E43CF25850408FA42D7DE76565561AE329B353B8FACC508ECE9875BCD1592`.

### Windows policy distinction

Use the documented Command Prompt entrypoint from the start: Explorer may block downloaded CMD/LNK files by extension/origin even when cmd.exe itself is allowed. Installation uses only Windows-provided commands; no application EXE is run during installation. The Start link is generated locally from serialized data; it is not a downloaded shortcut. Executable download-origin streams are not deliberately removed and every launched EXE/DLL remains subject to application-control checks. This is not a promise that a policy that prohibits Command Prompt, the Windows tools or the inherited app binaries can be satisfied.

References: [Microsoft script enforcement](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/app-control-for-business/design/script-enforcement) and [SAC overview](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/overview). A clean double-click installer with guaranteed SAC acceptance cannot be promised under the no-signing/no-new-binary constraints.
