// Quick AI answers in the command palette ("? question"), using the user's own Anthropic API key.
// Streams text back as it arrives. If the main model declines, the API retries on a fallback model server-side.

const MODEL = 'claude-opus-5-5';
const SYSTEM =
  'You are a quick assistant inside a small desktop command palette. Answer briefly (a few sentences at most) ' +
  'in the language the user wrote in. Use plain text, no markdown headings or tables.';

let client = null;
let clientKey = null;

function getClient(apiKey) {
  if (client && clientKey === apiKey) return client;
  const sdk = require('@anthropic-ai/sdk');
  const Anthropic = sdk.default || sdk.Anthropic || sdk;
  client = new Anthropic({ apiKey, baseURL: process.env.ISLANDLY_AI_BASE || undefined, maxRetries: 1, timeout: 60000 });
  clientKey = apiKey;
  return client;
}

/**
 * Ask a question. onText(chunk) receives streamed text.
 * Resolves to {ok:true} | {ok:false, reason:'no-key'|'refusal'|'error', message?}.
 */
async function ask(apiKey, question, onText, signal) {
  if (!apiKey) return { ok: false, reason: 'no-key' };
  try {
    const stream = getClient(apiKey).beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 2048,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: SYSTEM,
        messages: [{ role: 'user', content: String(question).slice(0, 4000) }],
      },
      { signal }
    );
    stream.on('text', (t) => onText(t));
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') return { ok: false, reason: 'refusal' };
    return { ok: true, truncated: message.stop_reason === 'max_tokens' };
  } catch (err) {
    if (signal && signal.aborted) return { ok: false, reason: 'aborted' };
    const status = err && err.status;
    return { ok: false, reason: status === 401 ? 'bad-key' : 'error', message: String((err && err.message) || err).slice(0, 300) };
  }
}

module.exports = { ask, MODEL };
