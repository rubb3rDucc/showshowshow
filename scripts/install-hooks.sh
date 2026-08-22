#!/bin/sh
# Point git at the committed hooks in .githooks/.
#
# Hooks in .git/hooks are per-clone and never committed, so they silently do
# not exist on a fresh clone or a new machine. core.hooksPath fixes that by
# pointing git at a tracked directory instead.
#
# Run once after cloning:   sh scripts/install-hooks.sh
set -e
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks
chmod +x .githooks/*
echo "core.hooksPath -> .githooks"
echo "Installed:"
ls -1 .githooks | sed 's/^/  /'
