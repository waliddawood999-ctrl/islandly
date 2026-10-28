# Islandly

A Dynamic Island for Windows: a small floating pill at the top of your screen that grows to show music, timers, battery, meetings and more.
جزيرة ديناميكية لويندوز: كبسولة صغيرة أعلى الشاشة تتمدد لتعرض الموسيقى والمؤقت والبطارية والاجتماعات وغيرها.

## 0.5.0 review build

The current review branch expands the existing application and fixes update lifecycle, stale requests, frozen renderer settings, late media artwork and privacy watcher restart bugs. **Windows acceptance is still required before release.**

See [the full feature and verification matrix](docs/IMPLEMENTATION-STATUS.md) (Arabic) and [build/integration instructions](docs/DEVELOPMENT.md). The matrix distinguishes implemented, conditional and incomplete functionality.

Available panels include media/art/optional lyrics and source selection; countdown/Pomodoro; battery/Bluetooth; 20 text/image clipboard items; file shelf and local image/PDF actions; calendar/prayers/weather; notes/tasks; CPU/RAM/network; application time; GitHub reviews/CI; notifications inbox; launchers; assistant/OCR/recording; terminal jobs; sandboxed text plugins and adhkar.

AI needs your own Anthropic key. Lyrics are opt-in (LRCLIB). FFmpeg/rembg are optional external tools. Reading Windows application notifications needs the native bridge in an installed, signed MSIX plus permission; an ordinary ZIP does not provide that capability. Quick controls for Wi-Fi, Bluetooth, output devices and DND open Windows Settings. There is no universal meeting mute/camera control, website time tracking or per-app battery attribution.

## Use and development

```sh
npm ci
npm test
npm start                       # Windows
npm run test:smoke              # real Electron renderer/IPC, on a desktop
npx electron test/update-flow.js
```

| Action | Control |
|---|---|
| Expand/pin | Hover/click island |
| Change panel | Wheel or dots |
| Volume / display | Shift+wheel / Alt+wheel |
| Toggle / Pomodoro | Ctrl+Alt+I / Ctrl+Alt+P |
| Selected Explorer files | Ctrl+Alt+S |
| Command palette | Ctrl+Alt+Space |
| Capture / clipboard text tools | Ctrl+Alt+O / Ctrl+Alt+T |
| Settings / quit | Tray menu |

Settings choose monitor, position, size, features and optional services. The island only accepts focus for text panels. Outside rounded bounds it passes pointer input through on Windows; mixed-DPI and game behavior remain part of Windows acceptance.

## Updates and privacy

This version is `islandlyBase: 3` and requires a full package from 0.4.0/base2 because runtime dependencies and bootstrap changed. The updater stages verified code files separately, preserves the running/previous versions, and enables rollback after an unsuccessful startup. File hashes protect download integrity, not a compromised trusted GitHub account. Review before merging to main: main drives automatic updates.

Clipboard and notification content remain in memory. Notes and app-use totals are local files. API keys require OS safeStorage (DPAPI on Windows); insecure Base64 fallback is removed. Calendar links are sensitive plaintext in local settings. Optional network services and LAN-sharing privacy are documented in the matrix. No telemetry was added.

## License

MIT, see [LICENSE](LICENSE). Keep third-party license notices when packaging, including native dependencies. FFmpeg/rembg/model binaries are not redistributed here.
