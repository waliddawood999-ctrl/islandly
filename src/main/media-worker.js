// Runs in a worker thread: the SMTC binding blocks its thread, so it must stay off Electron's main thread.
const { parentPort } = require('worker_threads');

let SMTCMonitor;
try {
  ({ SMTCMonitor } = require('@coooookies/windows-smtc-monitor'));
} catch (err) {
  parentPort.postMessage({ type: 'unavailable', reason: String(err) });
  return;
}

const PLAYING = 4;
const monitor = new SMTCMonitor();
let timer = null;
let lastTrackKey = '';
let lastThumb = null;

function toPayload() {
  const s = SMTCMonitor.getCurrentMediaSession();
  if (!s) return { type: 'media', active: false };

  const key = `${s.sourceAppId}|${s.media.title}|${s.media.artist}`;
  const trackChanged = key !== lastTrackKey;
  if (trackChanged) {
    lastTrackKey = key;
    lastThumb = s.media.thumbnail
      ? 'data:image/bmp;base64,' + Buffer.from(s.media.thumbnail).toString('base64')
      : null;
  }

  return {
    type: 'media',
    active: true,
    app: s.sourceAppId,
    title: s.media.title || '',
    artist: s.media.artist || '',
    playing: s.playback.playbackStatus === PLAYING,
    position: s.timeline.position || 0,
    duration: s.timeline.duration || 0,
    sentAt: Date.now(),
    trackChanged,
    thumb: lastThumb,
  };
}

// Events can arrive in bursts; coalesce them into one update.
function schedule() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    try {
      parentPort.postMessage(toPayload());
    } catch (err) {
      parentPort.postMessage({ type: 'media', active: false });
    }
  }, 120);
}

[
  'session-media-changed',
  'session-timeline-changed',
  'session-playback-changed',
  'session-added',
  'session-removed',
  'current-session-changed',
].forEach((evt) => monitor.on(evt, schedule));

schedule();
