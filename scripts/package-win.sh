#!/usr/bin/env bash
# Builds the Windows package (Islandly-win32-x64/Islandly.exe) from the committed files and zips it.
# Works from Linux or macOS; needs node, npm, python3 (for zip) and internet access.
#   scripts/package-win.sh [output-zip]
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$root/Islandly-win64.zip}"
work="$(mktemp -d)"
electron_version="$(node -p "require('$root/package.json').devDependencies.electron.replace(/^[^0-9]*/, '')")"

git -C "$root" archive HEAD --prefix=app/ | tar -x -C "$work"
cd "$work/app"
npm install --os=win32 --cpu=x64 --omit=dev --no-audit --no-fund >/dev/null
# The packager only needs electron to exist to read its version; the Windows binary is downloaded separately.
npm install --no-save --ignore-scripts --no-audit --no-fund "electron@$electron_version" >/dev/null
npx --yes @electron/packager . Islandly --platform=win32 --arch=x64 --out="$work/out" --overwrite --asar=false \
  --ignore="^/dev$" --ignore="^/test$" --ignore="^/scripts$" --ignore="^/\.git" >/dev/null

app="$work/out/Islandly-win32-x64/resources/app"
# keep only the native media module; everything else in node_modules is build tooling
find "$app/node_modules" -mindepth 1 -maxdepth 1 ! -name '@coooookies' -exec rm -rf {} +

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
