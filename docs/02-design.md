# Yowly: design system and brand mark

The live source of truth is `src/renderer/src/styles.css` (tokens at the top) and `src/renderer/src/Mascot.tsx`.

## Principles

1. Calm surface, lively mark. Only the Yowly mark and the primary action are orange.
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
- Status changes use `aria-live`. Dialogs are `aria-modal`. The mark has a text label per state.
- Light and dark both keep body text and orange text above 4.5:1.

## Brand mark: the voice-wave Y

**Concept.** Five rounded vertical bars, a voice waveform, that step down toward the middle so together they read as the letter Y. Speech (the wave) becomes something clear (a letter). It is an abstract symbol with no face or character.

**Shape rules.** Five bars of equal width with fully rounded ends, mirrored left to right. The centre bar is the longest and sits lowest. One orange gradient runs across the whole mark. No outline, no container, no extra shapes, so it stays legible at 16 px.

**States.** With no face, motion alone carries the state.

| State | Motion |
|---|---|
| Idle | still, slightly dimmed |
| Listening | bars bounce in a slow wave |
| Thinking | bars fade in and out in sequence |
| Transcribing | bars bounce in a fast wave |
| Success | whole mark pops once, full brightness |
| Error | bars shrink and turn warm grey, never red |

All motion stops under `prefers-reduced-motion`; state is then shown by the text beside the mark.

**Where it appears.** Sidebar brand (34 px, mirrors live state) · Dictate header (72 px) · recording pill (52 px) · empty states (96 px) · welcome (84 px) · tray and window icon (rasterized from the same SVG).

**App icon direction.** The mark centred on a warm charcoal rounded square (`#1c1a18`). For the macOS menu bar: the same five bars as a one-colour template image. Export sizes: 16, 32, 64, 128, 256, 512, 1024.

**Don'ts.** Do not add a face, eyes or a character. Do not rotate, outline or recolour the mark outside the orange gradient, white or near-black. No starburst or spark shapes, no terracotta.
