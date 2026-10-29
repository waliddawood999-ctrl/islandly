#!/usr/bin/env bash
# Builds the Windows package (Islandly-win32-x64/Islandly.exe) from the committed files and zips it.
# Works from Linux or macOS; needs node, npm, python3 (for zip) and internet access.
#   scripts/package-win.sh [output-zip]
set -euo pipefail
# Native Win32 entry point is compiled on Windows; never silently ship Electron as the idle owner.
: "${ISLANDLY_NATIVE_EXE:?Set ISLANDLY_NATIVE_EXE to the Windows-built native/bin/Islandly.exe (or use npm run package:native on Windows)}"

root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$root/Islandly-win64.zip}"
work="$(mktemp -d)"
electron_version="$(node -p "require('$root/package.json').devDependencies.electron.replace(/^[^0-9]*/, '')")"

git -C "$root" archive HEAD --prefix=app/ | tar -x -C "$work"
cd "$work/app"
npm install --os=win32 --cpu=x64 --omit=dev --no-audit --no-fund >/dev/null
# remember the production packages (top-level folder names) before build tooling is added
keep="$(npm ls --omit=dev --all --parseable 2>/dev/null | sed -n 's#.*/node_modules/\(@[^/]*\)/.*#\1#p; s#.*/node_modules/\([^@/][^/]*\)$#\1#p' | sort -u)"
# The packager only needs electron to exist to read its version; the Windows binary is downloaded separately.
npm install --no-save --ignore-scripts --no-audit --no-fund "electron@$electron_version" >/dev/null
npx --yes @electron/packager . Islandly --platform=win32 --arch=x64 --out="$work/out" --overwrite --asar=false \
  --ignore="^/dev$" --ignore="^/test$" --ignore="^/scripts$" --ignore="^/\.git" >/dev/null

mv "$work/out/Islandly-win32-x64/Islandly.exe" "$work/out/Islandly-win32-x64/IslandlyPanels.exe"
cp "$ISLANDLY_NATIVE_EXE" "$work/out/Islandly-win32-x64/Islandly.exe"
app="$work/out/Islandly-win32-x64/resources/app"
# keep only production packages; anything else in node_modules is build tooling
for d in "$app/node_modules"/*; do
  name="$(basename "$d")"
  grep -qxF "$name" <<<"$keep" || rm -rf "$d"
done
# koffi ships native builds for every OS; Windows x64 needs only its own
find "$app/node_modules/koffi/build/koffi" -mindepth 1 -maxdepth 1 ! -name 'win32_x64' -exec rm -rf {} +
rm -rf "$app/node_modules/koffi/doc" "$app/node_modules/koffi/src"
for m in @coooookies koffi adhan @anthropic-ai; do
  [ -d "$app/node_modules/$m" ] || { echo "missing $m in the package" >&2; exit 1; }
done

cat > "$work/out/Islandly-win32-x64/اقرأني.txt" <<'TXT'
Islandly - الجزيرة الديناميكية لويندوز

1) فك الضغط عن المجلد كاملاً (كليك يمين > Extract All / استخراج الكل).
2) افتح المجلد واضغط مرتين على Islandly.exe
3) تظهر الجزيرة أعلى منتصف الشاشة. لإغلاقها: كليك يمين على أيقونتها بجانب الساعة > خروج.

لو ظهرت نافذة زرقاء "Windows protected your PC": اضغط More info ثم Run anyway.
(تظهر لأن البرنامج جديد وغير موقّع رقمياً.)
بعد هذه النسخة يتحدّث التطبيق من نفسه تلقائياً.
TXT

rm -f "$out"
python3 -c "import shutil,sys; shutil.make_archive(sys.argv[1][:-4], 'zip', sys.argv[2], 'Islandly-win32-x64')" "$out" "$work/out"
rm -rf "$work"
echo "Built $out ($(du -h "$out" | cut -f1))"
