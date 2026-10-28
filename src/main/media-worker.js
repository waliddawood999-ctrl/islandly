// Runs in a worker thread: the SMTC binding blocks its thread, so it must stay off Electron's main thread.
const path = require("path");
const { parentPort, workerData } = require("worker_threads");

let SMTCMonitor;
try {
  // Updates are unpacked outside the app folder, so look for the native module in the packaged app too.
  const bases = [
    workerData && workerData.baseRoot,
    path.join(__dirname, "..", ".."),
  ].filter(Boolean);
  const entry = require.resolve("@coooookies/windows-smtc-monitor", {
    paths: bases,
  });
  ({ SMTCMonitor } = require(entry));
} catch (err) {
  parentPort.postMessage({ type: "unavailable", reason: String(err) });
  return;
}

const PLAYING = 4;
const monitor = new SMTCMonitor();
let timer = null;
let lastTrackKey = "";
let lastThumb = null;
let preferred = "";
parentPort.on("message", (m) => {
  if (typeof m.select === "string") {
    preferred = m.select;
    lastTrackKey = "";
    artworkDirty = true;
    schedule();
  }
});
let artworkDirty = true;

function toPayload() {
  const sessions = SMTCMonitor.getMediaSessions();
  const s =
    (preferred && sessions.find((x) => x.sourceAppId === preferred)) ||
    SMTCMonitor.getCurrentMediaSession();
  if (!s) {
    lastTrackKey = "";
    lastThumb = null;
    return { type: "media", active: false, sessions: [] };
  }

  const key = `${s.sourceAppId}|${s.media.title}|${s.media.artist}|${s.media.albumTitle}`;
  const trackChanged = key !== lastTrackKey;
  const artworkUpdated = trackChanged || artworkDirty;
  if (artworkUpdated) {
    artworkDirty = false;
    lastTrackKey = key;
    lastThumb = s.media.thumbnail
      ? "data:image/bmp;base64," +
        Buffer.from(s.media.thumbnail).toString("base64")
      : null;
  }

  return {
    type: "media",
    active: true,
    app: s.sourceAppId,
    sessions: sessions.map((x) => ({
      app: x.sourceAppId,
      title: x.media.title,
    })),
    title: s.media.title || "",
    artist: s.media.artist || "",
    playing: s.playback.playbackStatus === PLAYING,
    position: s.timeline.position || 0,
    duration: s.timeline.duration || 0,
    // When Windows last updated the position (ms). Browsers often only update it on play/pause/seek,
    // so the position must be projected forward from this moment, not from when we received it.
    updatedAt: Number(s.lastUpdatedTime) || 0,
    sentAt: Date.now(),
    trackChanged,
    thumb: artworkUpdated ? lastThumb : undefined,
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
      parentPort.postMessage({ type: "media", active: false });
    }
  }, 120);
}

[
  "session-media-changed",
  "session-timeline-changed",
  "session-playback-changed",
  "session-added",
  "session-removed",
  "current-session-changed",
].forEach((evt) =>
  monitor.on(evt, () => {
    if (
      evt !== "session-timeline-changed" &&
      evt !== "session-playback-changed"
    )
      artworkDirty = true;
    schedule();
  }),
);

schedule();
