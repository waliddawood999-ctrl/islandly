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
if [ -d "$root/bridge" ]; then cp -R "$root/bridge" "$work/app/bridge"; fi
cd "$work/app"
# Install exactly the lockfile, including Windows optional native binaries. No lifecycle scripts are needed.
npm ci --os=win32 --cpu=x64 --include=optional --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null
npx --yes @electron/packager@18.3.6 . Islandly --platform=win32 --arch=x64 --electron-version="$electron_version" --out="$work/out" --overwrite --asar=false --prune=false \
  --ignore="^/dev$" --ignore="^/test$" --ignore="^/scripts$" --ignore="^/docs$" --ignore="^/examples$" --ignore="^/native$" --ignore="^/\\.git" >/dev/null
app="$work/out/Islandly-win32-x64/resources/app"
for m in @coooookies/windows-smtc-monitor @coooookies/windows-smtc-monitor-win32-x64-msvc koffi adhan @anthropic-ai/sdk @img/sharp-win32-x64 pdf-lib tesseract.js; do
  [ -d "$app/node_modules/$m" ] || { echo "missing $m in the package" >&2; exit 1; }
done
# Keep the explicit terminal helper next to the executable for discoverability.
cp "$root/scripts/islandly-run.ps1" "$work/out/Islandly-win32-x64/"

cat > "$work/out/Islandly-win32-x64/اقرأني.txt" <<'TXT'
Islandly - الجزيرة الديناميكية لويندوز

1) فك الضغط عن المجلد كاملاً (كليك يمين > Extract All / استخراج الكل).
2) افتح المجلد واضغط مرتين على Islandly.exe
3) تظهر الجزيرة أعلى منتصف الشاشة. لإغلاقها: كليك يمين على أيقونتها بجانب الساعة > خروج.

هذه نسخة مراجعة غير موقّعة. تحقق من مصدر الملف قبل تشغيله.
قد تتطلب التغييرات في المحرك أو التبعيات تنزيل حزمة كاملة.
قراءة إشعارات Windows تحتاج حزمة MSIX موقعة ومثبتة ومنح الإذن.
TXT

rm -f "$out"
python3 -c "import shutil,sys; shutil.make_archive(sys.argv[1][:-4], 'zip', sys.argv[2], 'Islandly-win32-x64')" "$out" "$work/out"
rm -rf "$work"
echo "Built $out ($(du -h "$out" | cut -f1))"
