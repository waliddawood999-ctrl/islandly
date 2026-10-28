const crypto = require('crypto');

/** Compare dotted versions: negative, zero or positive like a - b. */
function cmp(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/** Git's own blob hash, so every downloaded file can be checked against the repository tree. */
function gitBlobSha(buf) {
  return crypto
    .createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf]))
    .digest('hex');
}

module.exports = { cmp, gitBlobSha };
