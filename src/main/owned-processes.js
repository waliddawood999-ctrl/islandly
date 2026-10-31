const children = new Map();
function track(child, type) {
  if (!child || !child.pid) return child;
  const pid = child.pid;
  children.set(pid, type);
  const remove = () => { children.delete(pid); require('./process-metrics').forget(pid); };
  child.once('exit', remove); child.once('error', remove);
  return child;
}
module.exports = { track, list: () => [...children].map(([pid, type]) => ({ pid, type })) };
