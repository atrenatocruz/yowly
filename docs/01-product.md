# Yowly: product brief, flows, screens

## Brief

Yowly turns speech into clean text anywhere on your desktop, and optionally hands that text to an AI agent.

- **Who:** people who write a lot (email, chat, docs, prompts) and think faster than they type.
- **Promise:** press a key, talk, get clean text at your cursor. Private and free by default. No surprise charges.
- **Personality:** friendly and quick, in a calm, premium interface.
- **Not in the MVP:** accounts, sync, team features, meeting recording, mobile app.

## User flows

**1. Dictate and insert (core loop)**
Hotkey → pill appears, Yowly listens → hotkey again (or release in push-to-talk) → transcribe on device → rule-based cleanup → text is pasted at the cursor. If pasting is not possible, it is copied and the pill says so.

**2. Dictate, review, transform**
Same start → Yowly opens with the text in the editor → edit, or click a transformation ("Professional email") → cost is shown before running → Insert (`Ctrl+Enter`) or Copy.

**3. Paid model with guard rails**
Pick a paid model → estimate shown under the model picker → Run → above your approval limit you confirm first → actual tokens and cost shown after → added to day/week/month totals.

**4. Cap reached**
Paid call would pass the monthly cap → call is blocked, nothing is charged → either automatic switch to a free/local model with a notice, or a dialog offering it.

**5. First cloud use**
Choosing a cloud transcription engine or running a cloud model the first time → consent dialog that says exactly what is sent and to whom.

**6. Errors**
Mic blocked, no mic, silence, too short, offline, provider down, bad key, rate limit, out of credit: each has a plain message and a next step (Retry, open Models, switch model).

## Information architecture

```
Recording pill (always on top, never takes focus)
Main window
├─ Dictate    editor · transformations · custom instruction · model + presets · cost · insert/copy
├─ History    search · reopen in editor · delete one · clear all
├─ Models     default agent · presets · API keys · model table with Free/Local/Paid/BYO labels
├─ Usage      today/week/month · monthly cap · approval limit · fallback · activity log
└─ Settings   dictation · transcription · cleanup · transformations · privacy and data · appearance
Command palette (Ctrl+K)   navigation, dictation, theme, mode, model switching
Tray icon                  open, start/stop dictation, quit
```

## Screen list

| Screen | Purpose | Key states |
|---|---|---|
| Welcome | Explain hotkey, privacy defaults, cost promise | first run only |
| Recording pill | Listening, transcribing, result | listening, transcribing, success, error + Retry |
| Dictate | Review, edit, transform, insert | empty, has text, agent working, last-run cost |
| History | Find and reuse past dictations | empty, results, no matches |
| Models | Choose agents, manage keys | key saved / missing, model unavailable |
| Usage | See and limit spend | under cap, near cap (80%), at cap, no cap |
| Settings | All preferences | hotkey taken, paste unavailable |
| Dialogs | Consent, approval, cap reached, delete data | — |

## Keyboard map

| Keys | Action |
|---|---|
| `Ctrl+Shift+Space` (editable) | Start/stop dictation, global |
| `Esc` while recording | Cancel |
| `Ctrl+K` | Command palette |
| `Ctrl+1…5` | Switch screen |
| `Ctrl+Enter` | Insert text |
| `Ctrl+Shift+C` | Copy text |
