#!/usr/bin/env bash
#
# Verifies the Kraya presence-subscribe-burst patch is applied.
# Run after a rebase/build and before shipping dist/wppconnect-wa.js into the extension.
# Exits non-zero (and loudly) if the unpatched upstream burst is still present, so a
# forgotten patch on a version bump can't silently re-ship the ban-causing behaviour.
#
# See KRAYA_PATCHES.md.
set -euo pipefail

src="src/chat/events/registerPresenceChange.ts"
bundle="dist/wppconnect-wa.js"
fail=0

# 1) Source check (always present).
if grep -q "ChatStore.map" "$src"; then
  echo "✗ FAIL: presence-subscribe burst still present in $src"
  echo "        → re-apply the Kraya patch (remove the ChatStore.map(...).presence.subscribe() fan-out) before building."
  fail=1
else
  echo "✓ source patched: no ChatStore.map fan-out in $src"
fi

# 2) Built-bundle check (only if a build exists).
if [ -f "$bundle" ]; then
  if grep -q "ChatStore.map" "$bundle"; then
    echo "✗ FAIL: built bundle $bundle still contains the burst — rebuild after applying the patch."
    fail=1
  else
    echo "✓ bundle patched: $bundle is clean"
  fi
else
  echo "• note: $bundle not built yet (run 'npm run build:prd')"
fi

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "Patch verification FAILED — do not ship this bundle. See KRAYA_PATCHES.md."
  exit 1
fi

echo ""
echo "All checks passed ✓"
