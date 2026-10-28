// Unit tests for the palette's pure helpers: calculator, units, currency parsing, workspaces, apps, privacy, GitHub links.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const calc = require('../src/main/services/calc');
const units = require('../src/main/services/units');
const rates = require('../src/main/services/rates');
const workspaces = require('../src/main/services/workspaces');
const { classify } = require('../src/main/clipboard');
const { parseActive } = require('../src/main/services/privacy');
const { htmlUrl } = require('../src/main/services/github');
const { prettyName } = require('../src/main/services/tracker');

let passed = 0;
const eq = (a, b, msg) => {
  assert.deepStrictEqual(a, b, msg);
  passed++;
};

// calculator
eq(calc.evaluate('2+3*4'), 14);
eq(calc.evaluate('(2+3)*4'), 20);
eq(calc.evaluate('2^10'), 1024);
eq(calc.evaluate('-3 + 5'), 2);
eq(calc.evaluate('120*15%'), 18);
eq(calc.evaluate('10 % 3'), 1);
eq(calc.evaluate('١٢٠×٣'), 360);
eq(calc.evaluate('10 ÷ 4'), 2.5);
eq(calc.evaluate('sqrt(16)+1'), 5);
eq(calc.evaluate('2pi'), Math.round(2 * Math.PI * 1e10) / 1e10);
eq(calc.evaluate('0.1+0.2'), 0.3);
eq(calc.evaluate('1,000*2'), 2000);
eq(calc.evaluate('42'), null, 'a plain number is not a calculation');
eq(calc.evaluate('1/0'), null, 'infinity is not a result');
eq(calc.evaluate('2+'), null);
eq(calc.evaluate('alert(1)'), null);
eq(calc.evaluate('process.exit()'), null);
eq(calc.evaluate('constructor'), null);
eq(calc.evaluate('hello world'), null);
eq(calc.evaluate('2**3'), null, 'not JS syntax');

// clipboard classification uses the safe evaluator and skips dates and ranges
eq(classify('12*3').type, 'math');
eq(classify('12*3').result, 36);
eq(classify('2026-10-28').type, 'text');
eq(classify('1-5').type, 'text');
eq(classify('+966 55 123 4567').type, 'phone');
eq(classify('https://example.com').type, 'url');

// units
eq(units.convert('5 km to mi').result, 3.106856);
eq(units.convert('100 f to c').result, 37.777778);
eq(units.convert('0 c in k').result, 273.15);
eq(units.convert('٣ كيلو إلى رطل').result, 6.613868);
eq(units.convert('1 gb to mb').result, 1024);
eq(units.convert('90 min to h').result, 1.5);
eq(units.convert('5 km to kg'), null, 'different kinds');
eq(units.convert('5 km'), null);

// currency query parsing (no network)
eq(rates.parseQuery('100 usd to sar'), { amount: 100, from: 'USD', to: 'SAR' });
eq(rates.parseQuery('٥٠ دولار إلى ريال'), { amount: 50, from: 'USD', to: 'SAR' });
eq(rates.parseQuery('5 km to mi'), null);
eq(rates.parseQuery('100 usd to usd'), null);

// workspaces
const ws = workspaces.parse('# comment\nStudy: https://classroom.google.com | C:\\Users\\me\\Uni | Word\nWork：github.com/me | ~/Projects\nC:\\no-name\nEmpty:');
eq(ws.length, 2);
eq(ws[0].name, 'Study');
eq(ws[0].items.map((i) => i.type), ['url', 'path', 'app']);
eq(ws[1].items[0], { type: 'url', value: 'https://github.com/me' });
eq(ws[1].items[1].type, 'path');
eq(workspaces.kind('1.5').type, 'app', 'a decimal number is not a web address');
eq(workspaces.kind('www.google.com').type, 'url');

// app index and ranking (uses a temporary Start Menu folder)
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apps-'));
fs.mkdirSync(path.join(dir, 'Office'));
for (const f of ['Visual Studio Code.lnk', 'Office/Word.lnk', 'Office/Excel.lnk', 'Uninstall Foo.lnk', 'readme.txt']) fs.writeFileSync(path.join(dir, f), '');
process.env.ISLANDLY_APPS_DIR = dir;
// Keep the runner's real Start Menu out of this three-shortcut fixture.
process.env.APPDATA = path.join(dir, 'user');
process.env.ProgramData = path.join(dir, 'shared');
const apps = require('../src/main/services/apps');
eq(apps.search('wo')[0].name, 'Word');
eq(apps.search('code')[0].name, 'Visual Studio Code');
eq(apps.search('vsc')[0].name, 'Visual Studio Code', 'in-order letters');
eq(apps.search('uninstall').length, 0, 'uninstallers are hidden');
eq(apps.list().length, 3);

// mic / camera parsing of `reg query /s` output
const reg = [
  'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone',
  '    Value    REG_SZ    Allow',
  '',
  'HKEY_CURRENT_USER\\...\\ConsentStore\\microphone\\Microsoft.WindowsSoundRecorder_8wekyb3d8bbwe',
  '    LastUsedTimeStart    REG_QWORD    0x1db0a1b2c3d4e5f',
  '    LastUsedTimeStop    REG_QWORD    0x0',
  '',
  'HKEY_CURRENT_USER\\...\\ConsentStore\\microphone\\NonPackaged\\C:#Users#me#AppData#Local#Discord#app-1.0#Discord.exe',
  '    LastUsedTimeStart    REG_QWORD    0x1db0a1b2c3d4e5f',
  '    LastUsedTimeStop    REG_QWORD    0x1db0a1b2c3d4e6f',
  '',
  'HKEY_CURRENT_USER\\...\\ConsentStore\\microphone\\NonPackaged\\C:#Program Files#Zoom#bin#Zoom.exe',
  '    LastUsedTimeStart    REG_QWORD    0x1db0a1b2c3d4e5f',
  '    LastUsedTimeStop    REG_QWORD    0x0',
  '',
  'HKEY_CURRENT_USER\\...\\ConsentStore\\microphone\\Never.Used_abc',
  '    LastUsedTimeStart    REG_QWORD    0x0',
  '    LastUsedTimeStop    REG_QWORD    0x0',
].join('\r\n');
eq(parseActive(reg), ['Microsoft.WindowsSoundRecorder', 'Zoom']);
eq(parseActive(''), []);

// GitHub web links
eq(htmlUrl({ subject: { url: 'https://api.github.com/repos/a/b/pulls/12' } }), 'https://github.com/a/b/pull/12');
eq(htmlUrl({ subject: { url: 'https://api.github.com/repos/a/b/issues/3' } }), 'https://github.com/a/b/issues/3');
eq(htmlUrl({ subject: { url: null }, repository: { html_url: 'https://github.com/a/b' } }), 'https://github.com/a/b');

eq(prettyName('chrome.exe'), 'Chrome');
eq(prettyName('chrome'), 'Chrome', 'the foreground watcher reports names without .exe');
eq(prettyName('MyTool.exe'), 'MyTool');

(async () => {
  // palette routing (no network: currency and AI are not exercised here)
  const { query } = require('../src/main/palette');
  const ctx = { settings: { workspaces: 'Study: https://a.com | Word' }, hasAiKey: false };
  const kinds = async (q) => (await query(q, ctx)).map((i) => i.kind);
  eq((await query('2+2', ctx))[0], { kind: 'copy', title: '4', sub: '2+2', icon: 'calc', text: '4' });
  eq((await query('5 km to mi', ctx))[0].text, '3.106856');
  eq((await kinds('? what is a black hole'))[0], 'ai');
  eq((await query('? hi', ctx))[0].needsKey, true);
  eq((await query('timer 25', ctx))[0], { kind: 'timer', title: '25', icon: 'timer', minutes: 25 });
  eq((await query('مؤقت ١٠', ctx))[0].minutes, 10);
  eq((await query('tr hello', ctx))[0].target.value.includes('tl=ar'), true);
  eq((await query('ترجم مرحبا', ctx))[0].target.value.includes('tl=en'), true);
  eq((await kinds('stu')).includes('workspace'), true);
  eq((await kinds('')).slice(0, 1), ['workspace']);
  eq((await query('github.com', ctx))[0].target, { type: 'url', value: 'https://github.com' });
  eq((await kinds('word')).includes('open'), true);
  const last = await query('something random', ctx);
  eq(last[last.length - 2].sub, 'searchWeb');
  eq(last[last.length - 1].kind, 'ai');

  console.log(`palette tests: ${passed} passed`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
