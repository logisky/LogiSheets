# Charts

Native Excel chart (`c:chartSpace`) support: read, render, create, edit, and
save charts, round-tripping through `.xlsx`. The chart definition's source of
truth is the Excel-native OOXML model, so charts interoperate with Excel/WPS and
need no proprietary migration.

## Architecture

```
xl/charts/chartN.xml (c:chartSpace)          ← source of truth, in the .xlsx
  ├─ crates/workbook            parse + serialize + lossless round-trip
  ├─ crates/controller          ChartManager (in Status; undo/redo via snapshot)
  │    ├─ payloads              CreateChart / MoveChart / DeleteChart
  │    └─ get_charts()          → ChartInfo (live values re-read from source ranges)
  ├─ crates/wasms/server        GetCharts RPC + payload dispatch
  └─ packages/engine            ChartLayer in Spreadsheet.svelte, rendered with ECharts
```

- **Source values are read live.** `get_charts` resolves each series' reference
  (e.g. `Sheet1!$B$2:$E$2`) to current cell values, so editing data updates the
  chart. The OOXML `numCache` is only a fallback.
- **Anchored by stable `CellId`.** Charts shift with row/column insert/delete,
  like images.
- **Rendering library: ECharts**, bundled in `logisheets-engine` as an external
  dependency + tree-shaken (`echarts/core` + `use()`), rendered as a DOM overlay
  (`.chart-layer`) positioned from the grid.

## What works

| Capability | Status | Verified by |
| --- | --- | --- |
| Read & display charts from `.xlsx` | ✅ | user + tests |
| Chart follows data edits (live values) | ✅ | `chart_reflects_live_data` |
| Select (click) | ✅ | user |
| Move (drag) | ✅ | `move_chart_updates_anchor` + user |
| Resize (corner handles) | ✅ | reuses MoveChart + user |
| Delete (Delete/Backspace) | ✅ | `delete_chart_removes_it` |
| Create from selection (toolbar 📊) | ✅ | `create_chart_from_scratch` + user |
| Save round-trips (incl. moved/created/deleted) | ✅ | tests |
| Lossless round-trip of chart part bytes | ✅ | `chart_round_trips` |
| Chart types: column, bar, line, area, pie, doughnut, scatter | ✅ | parser/serializer tests |
| Series colors match the workbook theme (scheme + RGB) | ✅ | `chart_reflects_live_data` |
| Reconfigure a chart's type/title (selection dropdown) | ✅ | `update_chart_changes_type_and_title` |

Undo/redo works for all chart edits (snapshot-based).

Series fill colors are resolved from the OOXML: direct RGB passes through, and
scheme colors (`accent1..6`, `tx/bg/dk/lt`, hyperlink) map to the workbook
theme, so a loaded chart matches Excel's colors. A selected chart shows a
type-picker dropdown (top-left) that reconfigures it in place via `UpdateChart`
(keeping the anchor and data references); `Engine.updateChart(id, {chartType,
title})` is the programmatic entry point.

## What's remaining

**Fidelity gaps**
- **Category labels** are not read live (values are); category axis uses the
  cached `strCache` labels.
- Color modifiers (`lumMod`/`lumOff` tints on scheme colors) and per-data-point
  pie slice colors are not applied — base scheme/RGB colors are.
- **`numCache` is not written on save.** Compliant readers recompute from the
  refs; a reader that only trusts the cache would show empty until recalculated.
- **Style/color/font detail** beyond type + title + legend position + axis
  titles is not modeled.

**Coverage gaps**
- Only column/bar/line/area/pie/doughnut/scatter. Combo, stock, radar, bubble,
  surface, 3-D, etc. are unsupported.
- **Non-chart `graphicData` (SmartArt, OLE embeds) does NOT round-trip** — the
  drawing `graphicFrame` model is chart-only, so such objects are dropped on
  save. (Plain charts and text-box shapes are preserved.)

**Editing gaps**
- Reconfiguring covers **type and title**; changing the legend position, axis
  titles, or the data range of an existing chart still needs UI.
- The insert button only creates a **column** chart; no chart-type picker on
  insert (you can switch type after, via the selection dropdown).

**Minor UX**
- The mouse wheel does not scroll the grid while the cursor is over a chart
  (the transparent drag-capture cover swallows it); could re-dispatch wheel to
  the canvas like the React overlay layers do.

## Key files

- `crates/workbook/src/ooxml/chart.rs` — parse (`parse_chart`) + generate
  (`build_chart_xml`).
- `crates/workbook/src/ooxml/drawing_part.rs` — `graphicFrame` anchor model.
- `crates/controller/src/chart_manager/` — `ChartManager` + executor.
- `crates/controller/src/api/worksheet.rs` — `get_charts` (live-value resolution).
- `packages/engine/src/lib/chart/` — ECharts setup + model + renderer.
- `packages/engine/src/lib/components/Spreadsheet.svelte` — `ChartLayer`,
  select/move/resize/delete, `insertChart`.
- `src/components/toolbar/index.tsx` — Insert Chart button.
