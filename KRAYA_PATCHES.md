# Kraya fork of wa-js — maintenance guide

This is **MiM-Essay's fork** of [`wppconnect-team/wa-js`](https://github.com/wppconnect-team/wa-js).
We carry a small set of Kraya-specific patches on top of upstream releases and ship the
built bundle into the Chrome extension as `Kraya-Whatsapp-Extension/src/js/wa-inject.js`.

> **TL;DR for a version bump:** `git fetch upstream --tags` → `git rebase <new-tag>` on the
> `kraya` branch → `npm run build:prd` → copy `dist/wppconnect-wa.js` into the extension →
> run `./verify-patch.sh` → PR on the extension repo.

---

## The patches we carry

| File | Change | Why |
|---|---|---|
| `src/chat/events/registerPresenceChange.ts` | Removed the all-chat `presence.subscribe()` fan-out on `conn.main_ready` (kept `register()`). | Upstream subscribes to presence for **every chat in the store, in parallel, the instant the session connects** — before any message is sent. On a large roster that's a burst of hundreds of stanzas that WhatsApp anti-abuse reads as automation, and is a leading cause of accounts being **restricted with zero messages sent**. Kraya never consumes the `chat.presence_change` event, so the subscription is pure ban risk. See Jira **KR-1071**. |

Keep this table updated whenever a patch is added or removed.

---

## Remotes

```
origin     https://github.com/MiM-Essay/wa-js.git        # our fork (push here)
upstream   https://github.com/wppconnect-team/wa-js.git   # the real upstream (fetch only)
```

If you cloned the fork and `upstream` is missing or points at the fork, fix it:

```bash
git remote set-url upstream https://github.com/wppconnect-team/wa-js.git
# or, if it doesn't exist:
git remote add upstream https://github.com/wppconnect-team/wa-js.git
```

## Branch

- **`kraya`** = an upstream release tag + our patches. This is the branch you build from and ship.
- Always base it on a **release tag** (e.g. `v4.3.0`), not on a random `main` commit, so rebases stay clean.

---

## First-time setup (new dev)

```bash
git clone https://github.com/MiM-Essay/wa-js.git
cd wa-js
git remote add upstream https://github.com/wppconnect-team/wa-js.git
git fetch upstream --tags
git checkout kraya
npm install        # Node 24 (see .nvmrc); see "npm cache" note below if you hit EACCES
```

## Build the bundle

```bash
npm run build:prd          # production (minified) → dist/wppconnect-wa.js
# npm run build:dev        # readable build with source maps, for debugging
```

Recommended install flags for a build-only checkout (skips git hooks + Playwright browser
download, which we don't need here):

```bash
HUSKY=0 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund
```

> **npm cache gotcha:** if `npm install` fails with `EACCES … ~/.npm/_cacache`, your npm
> cache is root-owned. Either add `--cache /tmp/npmcache` to the install command, or fix it
> once with `sudo chown -R "$(id -u):$(id -g)" ~/.npm`.

## Ship to the extension

```bash
cp dist/wppconnect-wa.js ../Kraya-Whatsapp-Extension/src/js/wa-inject.js
./verify-patch.sh                       # MUST pass before you commit
```

Then open a PR on `Kraya-Whatsapp-Extension` with the updated `wa-inject.js` (base `main`).

---

## Updating to a new wa-js version

Do this when upstream ships a release you need (usually because WhatsApp Web changed and
broke something):

```bash
git fetch upstream --tags
git checkout kraya
git rebase v4.4.0                       # <- the new release tag

#  If registerPresenceChange.ts conflicts (rare — it's a 5-line change), keep OUR version
#  of the conn.main_ready handler (register() only, no ChatStore.map subscribe), then:
#     git add src/chat/events/registerPresenceChange.ts && git rebase --continue

HUSKY=0 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund
npm run build:prd
./verify-patch.sh                       # fails loudly if the patch didn't survive the rebase
cp dist/wppconnect-wa.js ../Kraya-Whatsapp-Extension/src/js/wa-inject.js

git push --force-with-lease origin kraya
```

`git rebase <tag>` replays our patch commits on top of the new upstream version — that's the
whole "carry our change across versions" mechanic.

---

## Verify the patch survived (guard)

**Never ship a bundle without running this.** The real risk isn't the rebuild effort — it's
someone bumping the version and forgetting the patch, silently re-shipping the ban-causing
burst. `verify-patch.sh` greps the source and the built bundle for the upstream `ChatStore.map`
fan-out and fails if it's still there. Wire it into CI / a pre-push hook if you can.

---

## Long-term: drop the fork

The cleanest end state is to **not maintain a fork at all**. wa-js has a config system
(`src/config/`, merged from `window.WPPConfig`) with precedent for boolean guard flags
(e.g. `config.disableGoogleAnalytics`). If we upstream a flag like
`disablePresenceSubscriptionOnReady` (default `false` = current behavior) guarding the burst,
then Kraya can ship the **stock** wa-js bundle and just set, in the extension's `content.js`
before injecting wa-inject.js:

```js
window.WPPConfig = { disablePresenceSubscriptionOnReady: true };
```

Once that PR is merged upstream and released, retire this fork. Track that effort here when it exists.
