// Contract for the island visibility setting (always | approach): main default + validation, settings UI wiring, Arabic/English strings.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const settingsSrc = read('src/main/settings.js');
assert(/islandVisibility:\s*'always'/.test(settingsSrc), 'default must be always');
assert(/islandVisibility.*\['always', 'approach'\]/.test(settingsSrc), 'only always|approach accepted');

const html = read('src/settings/index.html');
assert(/<select id="islandVisibility">[\s\S]*value="always"[\s\S]*value="approach"[\s\S]*<\/select>/.test(html), 'settings select with both modes');
assert(/'islandVisibility'/.test(read('src/settings/settings.js')), 'settings.js wires the select to api.set');

for (const lang of ['ar', 'en']) {
  const strings = JSON.parse(read(`src/renderer/locales/${lang}.json`));
  for (const key of ['settings.visibility', 'settings.visibility.always', 'settings.visibility.approach', 'settings.visibility.hint']) assert(strings[key] && strings[key].length > 3, `${lang} missing ${key}`);
}
// Native host reads the same key and defaults to always.
assert(/Setting\("islandVisibility","always"\)\s*==\s*"approach"/.test(read('native/Islandly.cs')), 'native host honours islandVisibility');
console.log('visibility setting contract ok');
