const OWNER = 'waliddawood999-ctrl';
const REPO = 'islandly';
const DOWNLOAD_URL = `https://github.com/${OWNER}/${REPO}/releases/latest`;

async function latestRelease(fetchOk, apiBase) {
  let response;
  try {
    response = await fetchOk(`${apiBase}/repos/${OWNER}/${REPO}/releases/latest`);
  } catch (err) {
    // A repository without a published release has nothing to install.
    if (String(err.message).startsWith('404 ')) return null;
    throw err;
  }
  const release = await response.json();
  if (release.draft || release.prerelease) throw new Error('not a stable release');
  const match = /^v(\d+\.\d+\.\d+)$/.exec(release.tag_name);
  if (!match) throw new Error('invalid release tag');
  // target_commitish can be a moving branch. Resolve the tag itself instead.
  const commit = await (await fetchOk(`${apiBase}/repos/${OWNER}/${REPO}/commits/${encodeURIComponent(release.tag_name)}`)).json();
  if (!/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error('invalid release commit');
  return { version: match[1], sha: commit.sha, downloadUrl: DOWNLOAD_URL };
}

module.exports = { latestRelease, DOWNLOAD_URL };
