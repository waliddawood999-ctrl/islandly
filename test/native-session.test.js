const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const { NativeSession } = require('../src/main/native-session');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const input = new PassThrough(), output = new PassThrough();
  let text = '', quits = 0, active = true, snapshots = 0;
  const commands = [];
  output.on('data', chunk => { text += chunk; });
  const session = new NativeSession({ input, output, interval: 5, grace: 25,
    command: x => commands.push(x), quit: () => quits++, busy: () => active,
    restore: async () => commands.push('restore'), capture: async () => { snapshots++; return { running: true, endAt: 123 }; } });
  await sleep(35);
  assert.equal(snapshots, 0, 'must not snapshot or shut down before renderer hydration');
  await session.loaded();
  input.write('settings\nmalicious-command\n');
  await sleep(40);
  assert.equal(quits, 0, 'visible settings/palette/expanded panel holds runtime');
  assert.deepEqual(commands, ['restore', 'settings']);
  assert.match(text, /ISLANDLY:ready:/);
  const encoded = text.match(/ISLANDLY:state:([^\n]+)/)[1];
  assert.deepEqual(JSON.parse(Buffer.from(encoded, 'base64')), { running: true, endAt: 123 });
  active = false;
  await sleep(50);
  assert.equal(quits, 1, 'collapsed panels exit after grace');
  assert.match(text, /ISLANDLY:idle:/);
  const count = snapshots;
  await sleep(20);
  assert.equal(snapshots, count, 'no polling after shutdown');
  // Losing the native parent must also terminate a live panel runtime.
  const parent = new PassThrough();
  const orphan = new NativeSession({ input: parent, output: new PassThrough(), interval: 100,
    command() {}, quit() { quits++; }, busy: () => true, capture: async () => ({}), restore: async () => {} });
  parent.end(); await sleep(10); orphan.stop();
  assert.equal(quits, 2);
  console.log('Native session: hydration, snapshot transfer, busy/grace shutdown, allowlist and parent loss pass');
})().catch(err => { console.error(err); process.exit(1); });
