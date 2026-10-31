#!/usr/bin/env bash
# T18 has one canonical Windows build; the old stamping path would change identity.
set -euo pipefail
printf '%s\n' 'Use npm run package:native on Windows with the pinned reference ZIP. The legacy stamping/renaming packager is disabled for T18.' >&2
exit 1
