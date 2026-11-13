# Yowly: design system and mascot

The live source of truth is `src/renderer/src/styles.css` (tokens at the top) and `src/renderer/src/Mascot.tsx`.

## Principles

1. Calm surface, lively mascot. Only the owl and the primary action are orange.
2. Typography leads. Few borders, no decorative chrome.
3. Keyboard first. Everything reachable without a mouse.
4. Honest states. Cost, privacy and errors are always said in plain words.

## Color

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#141311` | `#f7f3ec` | window |
| `--surface` | `#1c1a18` | `#fffdf9` | sidebar, cards, inputs |
| `--raised` | `#262320` | `#f0ebe2` | buttons, selected rows |
| `--border` | `#36322d` | `#ddd5c8` | hairlines |
| `--text` | `#ece7df` | `#1e1b17` | body text |
| `--muted` | `#a39b8e` | `#6b6459` | secondary text |
| `--accent` | `#ff7a1a` | `#f26a0d` | focus ring, active marker |
| `--accent-text` | `#ff9547` | `#b34700` | orange used as text |
| `--grad` | `#ff6a0d → #ffab3d` at 135° | same | primary button, meters, waveform |
| `--ok / --warn / --danger` | `#7bc47f / #f0b354 / #f08a7a` | `#2f7d38 / #9a5b00 / #b3382a` | status |

The orange is a vivid amber "ember", warmer and brighter than terracotta, always paired with warm charcoal neutrals.
Text on the gradient is near-black (`#1b1206`) for contrast. Orange as text uses `--accent-text`, never raw `--accent`.

## Typography

- Family: the system UI font (Segoe UI Variable on Windows, San Francisco on macOS). No bundled fonts.
- Scale: 0.82 / 0.94 (body) / 1.05 (editor) / 1.2 (dialog title) / 1.6 (screen title) rem.
- Screen titles: weight 600, tracking −0.02em. Section labels: 0.8rem uppercase, tracking 0.06em, muted.
- Numbers in tables and tiles use tabular figures.
- Text size setting scales the root font: 0.9, 1, 1.15, 1.3.

## Spacing and shape

- Spacing: 4, 8, 12, 16, 24, 40 px.
- Radius: 9 px controls, 12 px cards, 16 px dialogs, full pill for chips and primary CTA.
- Content column: 780 px max. Sidebar: 212 px.

## Components

Button (default, primary, danger, big) · Chip (transformations) · Segmented preset · Select · Input · Toggle ·
Tag (Free / Local / Paid / BYO key) · Tile · Meter · Table · List item · Dialog · Command palette · Toast · Recording pill.

## Accessibility

- Visible 2 px orange focus ring on every interactive element.
- `prefers-reduced-motion` turns off all animation.
- Status changes use `aria-live`. Dialogs are `aria-modal`. Mascot has a text label per state.
- Light and dark both keep body text and orange text above 4.5:1.

## Mascot: Yowly the owl

**Concept.** A compact, round owl. Its crest is five rounded bars, a voice waveform, so the brand idea (speech becomes clear thought) is in the silhouette. Big eyes in a dark mask carry all expression. A small waveform mark sits on the chest.

**Shape rules.** Rounded-square body, two soft ear tufts, crest between them. Orange gradient body, dark neutral mask, cream eyes. Two colors plus neutrals. No outlines, no gloss, so it stays legible at 16 px.

**States**

| State | Eyes | Crest | Extra |
|---|---|---|---|
| Idle / sleeping | closed, relaxed arcs | low, still | small fading "z" |
| Listening | wide, large pupils | bouncing with the voice | pill border turns orange |
| Thinking | pupils up and to the side | slow wave | two rising dots |
| Transcribing | half-lidded, looking down | fast wave | sound arcs at both sides |
| Success | happy upward arcs | full height | one small hop |
| Error | worried brows, looking down | drooped | desaturated, never red |

**Where it appears.** Sidebar brand (34 px, mirrors live state) · Dictate header (72 px) · recording pill (52 px) · empty states (96 px) · welcome (84 px) · tray and window icon (rasterized from the same SVG).

**App icon direction.** The owl's head and crest, centered on a warm charcoal rounded square (`#1c1a18`), orange gradient body. For the menu bar: a one-color template version of the same silhouette (head outline + five crest bars). Export sizes: 16, 32, 64, 128, 256, 512, 1024.

**Don'ts.** No starburst or spark shapes, no abstract "AI orb", no terracotta, no serif wordmark. Yowly is always a character with a face.
