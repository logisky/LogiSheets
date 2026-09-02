---
description: Native Excel chart support in LogiSheets — read, render, create, edit and save OOXML charts (c:chartSpace) with lossless .xlsx round-tripping.
---

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
  │    ├─ payloads              CreateChart / UpdateChart / MoveChart / DeleteChart
  │    └─ get_charts()          → ChartInfo (live values re-read from source ranges)
  ├─ crates/wasms/server        GetCharts RPC + payload dispatch
  └─ packages/engine            ChartLayer in Spreadsheet.svelte, rendered with ECharts
```

- **Source values are read live.** `get_charts` resolves each series' reference
  (e.g. `Sheet1!$B$2:$E$2`) to current cell values, so editing data updates the
  chart. Category labels and number formats are read live the same way. The
  OOXML `numCache` is only a fallback.
- **Editing rewrites the chart XML.** `UpdateChart` patches the parsed model and
  regenerates `c:chartSpace` from it. Everything the editor understands is
  typed; everything else — fills, fonts, gridlines, markers, 3-D settings,
  trendlines — is captured as verbatim `Unparsed` subtrees (`PreservedXml`) and
  written back untouched, so an edit cannot silently restyle a chart authored in
  Excel. The chart's relationships and its sibling `style1.xml` / `colors1.xml`
  parts ride along too. Adding a typed field means adding it to *both*
  `ChartData` and `build_chart_xml`.
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
| Chart types: all 16 classic `c:*Chart` groups | ✅ | round-trip tests per kind + `new_kinds_do_not_leak_settings` |
| Combo charts (a kind per series) | ✅ | `combo_chart_keeps_every_group`, `create_a_combo_chart_and_keep_it_through_edits` |
| Series colors match the workbook theme (scheme + RGB) | ✅ | `chart_reflects_live_data` |
| Category labels follow the source cells (formatted) | ✅ | `chart_categories_and_formats_are_live` |
| Data labels (value / category / series name / percent, position) | ✅ | `update_chart_changes_every_setting` + browser |
| Number formats on labels and the value axis | ✅ | same |
| Reconfigure type, title, legend, stacking, axis titles | ✅ | `update_chart_changes_every_setting` |
| Re-point the data (categories, per-series range, name, color) | ✅ | `update_chart_repoints_series_and_keeps_colors` |
| Size-anchored charts (`oneCellAnchor`) draw at their real size | ✅ | browser |
| Insert picks the chart type; labels/series inferred from the selection | ✅ | browser |
| Editing keeps unmodeled styling (fonts, fills, gridlines, markers) | ✅ | `rebuilding_keeps_unmodeled_styling`, `editing_a_chart_keeps_its_styling_and_satellite_parts` |
| Editing keeps the chart's rels and style/colors parts | ✅ | same |
| Value-axis scale: min, max, unit, log base, reverse | ✅ | `update_chart_sets_the_axis_scale`, `axis_scale_round_trips` |

Undo/redo works for all chart edits (`chart_edits_are_undoable`). Charts live in
`Status`, which the undo stack snapshots whole on every undoable action — which
is why `ChartManager` uses persistent (`imbl`) collections: a snapshot is a
refcount bump, not a deep copy of every chart's preserved XML. For the same
reason `charts_of_sheet` hands out borrows rather than a cloned `Vec`.

Series fill colors are resolved from the OOXML: direct RGB passes through, and
scheme colors (`accent1..6`, `tx/bg/dk/lt`, hyperlink) map to the workbook
theme, so a loaded chart matches Excel's colors. Regenerating the XML on an edit
writes those colors back, so a re-typed or re-pointed chart keeps its palette.

A selected chart shows a type picker and a ⚙ button; the ⚙ opens the chart
editor (`ChartSettings.svelte`) — type, title, legend position, stacking, axis
titles, value-axis scale (min / max / unit / log base / reverse), data labels,
number format, and the data itself (category range, plus each series' name /
range / color, with add and remove). Every control is one field of
`UpdateChart`, and `Engine.updateChart(id, patch)` is the same thing
programmatically.

Most `UpdateChart` fields patch (`None` keeps, `""` clears). The axis scale is
the exception: it replaces the scale wholesale, which is the only way to put a
fixed bound back to automatic.

**Where numbers get formatted.** Data labels and category labels are rendered
core-side with `ssf-rs` and shipped as strings (`ChartSeriesInfo.formattedValues`),
so they match the sheet exactly. Axis ticks are the exception — the renderer
picks the tick values, so the engine formats them with `formatAxisNumber`, a
small subset renderer (separators, decimals, percent, currency affixes).

## What's remaining

**Fidelity gaps**
- Fonts, fills, gridline styling and 3-D effects survive an edit but are not
  *rendered* — the ECharts layer draws its own defaults. They are preserved for
  Excel, not reproduced here.
- Color modifiers (`lumMod`/`lumOff` tints on scheme colors) and per-data-point
  pie slice colors are not applied — base scheme/RGB colors are.
- **`numCache` is not written on save.** Compliant readers recompute from the
  refs; a reader that only trusts the cache would show empty until recalculated.
- Setting a series color explicitly replaces that series' whole `c:spPr`, so a
  custom outline or effect on *that* series is dropped in exchange. Leaving
  colors alone keeps it byte-for-byte.
- Series names are literals, not references: renaming the header cell does not
  rename the series.
- A secondary value axis is not modeled.

**Coverage gaps**
- **All 16 classic `c:*Chart` groups** are read, written and editable. The
  `cx:` family (treemap, sunburst, histogram, pareto, box &amp; whisker,
  waterfall, funnel, filled map) lives in a different part and is not.
- A **combo chart** is modeled as one whose series disagree: `ChartSeries`
  carries an optional `series_type`, and the writer emits one plot group per
  distinct kind, the chart's own kind first. Only the flat category/value kinds
  combine (`is_combinable`); an override Excel could not honour folds back into
  the primary group rather than producing a file it would refuse. Series keep
  the order `c:order` gave them, not the order the groups were read in.
- Per-group settings of a combo's *secondary* groups are not modeled — the
  file's settings describe the primary group, and the rest get defaults.
- The **3-D kinds render flat** (`col3d` draws as `col`, and so on): the depth
  round-trips to Excel but drawing it would mean pulling in `echarts-gl`.
- Some kinds are rendered as the nearest thing ECharts core can draw, which is
  a deliberate trade rather than a bug: **stock** becomes a candlestick (an
  HLC chart has no open, so open is set to the close), a **surface** becomes a
  heatmap of the same grid, and the **3-D** kinds become their flat forms. All
  still round-trip to Excel as their proper type.
- A stock chart's series are read **positionally** (4 = open/high/low/close,
  3 = high/low/close); any other count falls back to plain lines. Volume
  variants, which put volume on a secondary axis, are not modeled.
- Of-pie honours `splitType` `pos`/`val`/`percent`; `cust` (a hand-assigned
  split) falls back to the automatic one, though the `c:custSplit` element is
  preserved.
- **The modern "chartEx" family is not read at all**: treemap, sunburst,
  histogram, Pareto, box & whisker, waterfall, funnel and filled map live in a
  separate part (`xl/charts/chartEx1.xml`, `cx:` namespace, its own
  relationship type) that the reader does not pick up.
- **Chart sheets** (a whole sheet that is one chart) are not supported.
- **An unsupported chart is dropped on save.** `parse_chart` returns `None`, the
  chart never enters `ChartManager`, and the save path only emits anchors for
  charts it holds — so the drawing goes out without it. Verified by hand on a
  fixture whose `c:barChart` was swapped for `c:bubbleChart` before bubble was
  supported.
- 100% stacked (`percentStacked`) is read as plain `stacked`, so editing such a
  chart degrades it to a normal stacked one.
- **Non-chart `graphicData` (SmartArt, OLE embeds) does NOT round-trip** — the
  drawing `graphicFrame` model is chart-only, so such objects are dropped on
  save. (Plain charts and text-box shapes are preserved.)

**Minor UX**
- The mouse wheel does not scroll the grid while the cursor is over a chart
  (the transparent drag-capture cover swallows it); could re-dispatch wheel to
  the canvas like the React overlay layers do.

## Selecting a chart

Clicking a chart selects it, and the cells it plots are outlined on the grid in
the colour of the series they feed — categories dashed, bubble sizes dotted —
so you can see what a chart is reading without opening the editor. The ranges
come from `chart/source-ranges.ts`, which parses the chart's own A1 references.

One thing it will not draw: a range on another sheet, which the editor lists
instead. A range that has scrolled out of view is skipped too (`isRangeVisible`),
since there is nothing to show.

Both the outlines and the chart frames are positioned with
`xForColStartUnclamped` / `yForRowStartUnclamped` rather than the plain
helpers. The plain ones only walk the rows and columns the grid has laid out,
so they answer with the window's own edge for anything scrolled past — which
flattens an overlay against the edge instead of letting it scroll away. The
unclamped pair extrapolates at the size of the row/column nearest that edge,
exact whenever the ones outside match it.

## Inserting from a selection

`chart/from-selection.ts` turns the selected range into the chart's data
references, the way Excel infers them: a leading column of text becomes the
categories, a leading row of text becomes the series names, every other column
is a series. The corner cell votes for neither edge — the label column is
decided from the rows below it and the header row from the data columns to its
right — so a table with row labels but no header row keeps its first row as
data. A bubble chart reads differently: its first data column is the shared X
and the rest pair up as (Y, size).

It takes cell lookups as a `SelectionCells` interface rather than the data
service, so the inference is unit-tested without a workbook
(`from-selection.test.ts`).

## Key files

- `crates/workbook/src/ooxml/chart.rs` — parse (`parse_chart`) + generate
  (`build_chart_xml`).
- `crates/workbook/src/ooxml/drawing_part.rs` — `graphicFrame` anchor model.
- `crates/controller/src/chart_manager/` — `ChartManager` + executor.
- `crates/controller/src/api/worksheet.rs` — `get_charts` (live-value resolution).
- `packages/engine/src/lib/chart/` — ECharts setup, model, renderer,
  `ChartSettings.svelte` (the editor), `num-format.ts` (axis ticks),
  `from-info.ts` (binding → model), `from-selection.ts` (insert inference) and
  `source-ranges.ts` (the source outlines). The non-Svelte modules are the
  engine's tested seam.
- `packages/engine/src/lib/components/Spreadsheet.svelte` — `ChartLayer`,
  select/move/resize/delete, `insertChart`.
- `src/components/toolbar/index.tsx` — Insert Chart button + type menu.
