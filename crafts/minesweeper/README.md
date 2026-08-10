# minesweeper (扫雷)

Classic Minesweeper on a LogiSheets grid. **Left-click** a cell to reveal it,
**right-click** to flag/unflag. Numbers show how many of the 8 neighbors are
mines; revealing a blank flood-fills the open area. Reveal every non-mine cell
to win; hit a 💣 and it's over.

## How it works (reuses the game-craft patterns)

- Own worksheet `扫雷`, square cells (30px), created once via `ensureSheet`; the
  whole max region (16×30) is cleared and re-bordered on each new game so a
  smaller board doesn't leave the previous one behind.
- Cells are pattern fills (`{red,green,blue}`); numbers/💣/🚩 are cell content;
  number colors are the classic 1–8 palette as **standard-ARGB strings** (8 hex,
  no `#`). Borders likewise ARGB.
- `window.onCanvasInput` — left `mousedown` reveals, right (`button===2`) flags;
  `contextmenu` consumed (no native menu); mousedown consumed on the board
  (blocks selection + double-click edit). `setSelectionSuppressed(true)`.
- **First click is always safe**: mines are placed only after the first reveal,
  avoiding the clicked cell and its neighbors, so the first click opens an area.
- Only the changed cells are repainted per action (flood-fill reveal / flag).
- **Progress** (`get/setCraftState`): `{ difficulty, best }` — best time per
  difficulty; a panel timer runs from the first reveal to win/loss.

Difficulties: 初级 9×9/10 · 中级 16×16/40 · 高级 16×30/99.

## Build

```bash
yarn build   # vite (UMD) → copies index.html + minesweeper.js to public/minesweeper/
```
