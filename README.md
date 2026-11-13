# Yowly

Voice-first AI assistant for desktop. Press a hotkey, talk, get clean text at your cursor.

## Run

```bash
npm install
npm run dev
```

- `npm test` runs the core unit tests.
- `npm run typecheck` checks types.
- `npm run build` then `npm start` runs the production build.
- Smoke check (saves a screenshot of every screen, then exits): set `YOWLY_SHOT` to a folder and run `npx electron .` after a build. Add `YOWLY_SHOT_STT=1` to also load the speech model.

## Use

1. Press `Ctrl+Shift+Space`, talk, press it again. `Esc` cancels.
2. Edit the text, run a transformation if you like, then `Ctrl+Enter` to insert.
3. For AI actions, add a free OpenRouter key in **Models**, or install Ollama for fully local models.

## Layout

| Path | What |
|---|---|
| `src/core` | Portable logic: cleanup, cost and cap rules, model catalog, providers |
| `src/main` | Electron shell: hotkeys, insertion, keychain, storage, orchestration |
| `src/renderer` | React UI, brand mark, recording pill, on-device Whisper worker |
| `docs` | Product brief, design system, architecture and plan, security checklist |

## Website

The download page lives in `site/` and is served by GitHub Pages from the `gh-pages` branch. To publish changes:

```bash
git subtree push --prefix site origin gh-pages
```
