# LGTMute

<img width="1195" height="1220" alt="image" src="https://github.com/user-attachments/assets/4d845d69-b405-46b4-b740-77a745231891" />

LGTMute is a lightweight GitHub noise filter available both as a Chrome extension and as a standalone userscript. It adds quick controls to hide noisy posts, replies, threads, and authors from your own view.

It is intentionally local-only:

- No GitHub account settings are changed.
- No network requests are sent on your behalf.
- Extension rules are stored in `chrome.storage.sync`.
- Userscript rules are stored in `localStorage`.

## What It Does

- Adds an `LGTMute` action menu to supported GitHub comment headers.
- Lets you hide one post/reply, hide an entire thread, mute an author in the current repo, or mute them across GitHub.
- Shows one action entry per author on the first detected comment and skips your own logged-in account.
- Persists rules across sessions.
- Extension build: includes a popup shortcut plus a dedicated options/control panel for site-wide mutes, repo mutes, hidden comments, and hidden threads.
- Userscript build: includes the in-page hide/mute controls plus an in-page control panel overlay for stats, enable/disable, and rule management. It does not include the browser popup or extension options page.

## Build

```bash
npm install
npm run typecheck
npm run test
npm run format
npm run build
```

The production extension bundle is written to `dist/`.
The userscript bundle is written to `dist/lgtmute.user.js`.

## Load In Chrome

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the `dist/` directory from this repository.

This packaged extension target is for Chrome/Chromium browsers.

## Install As A Userscript

1. Build the project so `dist/lgtmute.user.js` exists.
2. Install a userscript manager such as Violentmonkey or Tampermonkey.
3. Create a new script and paste the contents of `dist/lgtmute.user.js`, or import that file directly.
4. Open any `https://github.com/*` issue or pull request page.
5. Use the floating `LGTMute` button, or press `Alt+Shift+M`, to open the userscript control panel overlay.

The userscript is the cross-browser path and is intended to work in Firefox and Chrome-family browsers.

## Project Structure

- `src/content/`: GitHub DOM discovery, injected controls, and hide/reveal behavior.
- `src/userscript/`: Userscript bootstrap and local storage backend.
- `src/shared/`: Storage, rule evaluation, and GitHub key helpers.
- `src/popup/`: Lightweight popup for enable/disable and quick stats.
- `src/options/`: Full rule management UI.
- `tests/`: Unit tests for rule logic and GitHub target discovery.

## Design Decisions

- Manifest V3 with least-privilege permissions: `storage` plus `https://github.com/*`.
- The extension and userscript share the same content runtime; only the storage/bootstrap layer changes.
- The userscript uses `localStorage` and standard DOM APIs only; it does not depend on privileged userscript APIs.
- No background service worker: the extension does not need one.
- DOM work is batched behind `requestAnimationFrame` and a root-scoped `MutationObserver`, not a full-document watcher.
- Target detection is layered: modern GitHub issue-body/data-testid surfaces first, legacy timeline surfaces second, heuristic fallback last.
- Matching fails closed and prefers stable GitHub identifiers such as issue, comment, and discussion fragments.
- Detection is covered by fixture-backed tests using sanitized real GitHub markup samples.

## Current Limits

- The extension targets GitHub timeline-style discussions, issues, pull requests, and similar comment surfaces.
- GitHub changes its DOM frequently, so selectors are intentionally heuristic and scoped to comment-like containers.
