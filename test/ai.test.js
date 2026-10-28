// Checks the AI request shape and streaming/refusal handling against a local fake API (no network, no real key).
const assert = require('assert');
const http = require('http');

const sse = (events) => events.map(([type, data]) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`).join('');
const message = (stop) => [
  ['message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, usage: { input_tokens: 5, output_tokens: 0 } } }],
  ['content_block_start', { index: 0, content_block: { type: 'text', text: '' } }],
  ['content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'مرحباً ' } }],
  ['content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'بك' } }],
  ['content_block_stop', { index: 0 }],
  ['message_delta', { delta: { stop_reason: stop }, usage: { output_tokens: 3 } }],
  ['message_stop', {}],
];

let lastRequest = null;
let mode = 'ok';
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    lastRequest = { url: req.url, headers: req.headers, body: JSON.parse(body || '{}') };
    if (mode === 'bad-key') {
      res.writeHead(401, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }));
    }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end(sse(message(mode === 'refusal' ? 'refusal' : 'end_turn')));
  });
});

server.listen(0, async () => {
  process.env.ISLANDLY_AI_BASE = `http://127.0.0.1:${server.address().port}`;
  const ai = require('../src/main/services/ai');
  try {
    assert.deepStrictEqual(await ai.ask('', 'hi', () => {}), { ok: false, reason: 'no-key' });

    let text = '';
    const r = await ai.ask('sk-test', 'سلام', (t) => (text += t));
    assert.deepStrictEqual(r, { ok: true, truncated: false });
    assert.strictEqual(text, 'مرحباً بك');
    const b = lastRequest.body;
    assert.strictEqual(lastRequest.url.split('?')[0], '/v1/messages');
    assert.strictEqual(b.model, 'claude-opus-5-5');
    assert.strictEqual(b.fallbacks, 'default');
    assert.deepStrictEqual(b.output_config, { effort: 'low' });
    assert.strictEqual(b.stream, true);
    assert.match(lastRequest.headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
    // SDK v1 sends the key as a bearer token; older versions used x-api-key
    assert.ok(lastRequest.headers['x-api-key'] === 'sk-test' || lastRequest.headers.authorization === 'Bearer sk-test');

    mode = 'refusal';
    assert.deepStrictEqual(await ai.ask('sk-test', 'x', () => {}), { ok: false, reason: 'refusal' });

    mode = 'bad-key';
    assert.strictEqual((await ai.ask('sk-wrong', 'x', () => {})).reason, 'bad-key');
    console.log('ai tests ok');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
