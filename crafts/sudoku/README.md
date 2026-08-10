# sudoku (数独)

Sudoku on a LogiSheets sheet. The craft lays out a puzzle; you then **type
digits straight into the cells** and a small block of **plain, readable
spreadsheet formulas** checks for conflicts live.

## Design notes

- **Solvable, not necessarily unique.** The puzzle is dug from a complete valid
  grid (randomized backtracking), so a solution always exists. Uniqueness is
  intentionally *not* guaranteed — no solution-counting solver — to keep it
  simple.
- **No canvas interception / no selection suppression / no craft-state.** Unlike
  the other game crafts, the player edits cells normally; the craft only does a
  one-time layout, then it's an ordinary spreadsheet.
- **Live conflict check = ordinary formulas** (they recompute on every cell
  edit via the normal dependency graph). Only *scalar* `COUNTIF` is used — the
  engine does **not** support array criteria like `COUNTIF(range,range)`
  (returns `#UNKNOWN!`), so each check counts digits 1–9 explicitly:
  `=IF((COUNTIF(rng,1)>1)+…+(COUNTIF(rng,9)>1)>0,"❌","✅")`.
  Layout: `K1:K9` row checks, `A11:I11` column checks, `K11:M13` box checks,
  `K15` overall status (`COUNTIF(...,"❌")` + `COUNTBLANK` of the board).
- Board: 9×9 square cells, thin gridlines with **thick 3×3 box borders** (border
  colors are the engine's standard ARGB strings — 8 hex, no `#`). Clues render
  bold/black on light gray; the player's entries are blue; "显示答案" fills blanks
  green.

Controls: 难度 (easy 40 / medium 32 / hard 26 clues) · 新数独 · 清空我的填写 · 显示答案.

## Build

```bash
yarn build   # vite (UMD) → copies index.html + sudoku.js to public/sudoku/
```
