// Keep background features that users rely on; suspend display-only and optional work.
function activityPolicy({ hidden, fullscreen, expanded, eco, clipboard, tracking }) {
  const visible = !hidden && !fullscreen;
  return { clipboard: visible && clipboard, clipboardMs: eco ? 4000 : 800, bluetooth: visible && expanded && !eco, system: visible && expanded && !eco,
    networkPaused: !visible || eco, tracking: tracking && !eco, foregroundMs: eco ? 3000 : 1000 };
}
module.exports = { activityPolicy };
