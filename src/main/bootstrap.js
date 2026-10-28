// Packaged entry point: downloaded code can never replace this bootstrap.
const path = require('path');
const Module = require('module');
const { app } = require('electron');
const { readJson, selectBoot } = require('./update-state');
const baseRoot = path.join(__dirname, '..', '..');

// Obtain the process lock BEFORE touching booting state; a second launch is not a crash.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let selected;
  try { selected = selectBoot(baseRoot, app.getPath('userData')); } catch (_) {
    const pkg = readJson(path.join(baseRoot, 'package.json'));
    selected = { root: baseRoot, baseRoot, version: pkg.version, baseVersion: pkg.version };
  }
  // Downloaded code lives outside resources/app; resolve native/runtime modules from the install.
  const deps = path.join(baseRoot, 'node_modules');
  process.env.NODE_PATH = [deps, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
  Module._initPaths(); // Tested with Electron 45 / Node 24; globalPaths.push does not affect resolution.
  global.__ISLANDLY = selected;
  selected.instanceLock = true;
  if (selected.root !== baseRoot) {
    const watchdog = setTimeout(() => {
      if (readJson(selected.currentFile)?.booting) app.exit(1);
    }, 30000);
    watchdog.unref();
  }
  require(path.join(selected.root, 'src', 'main', 'main.js'));
}
