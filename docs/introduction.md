---
description: What LogiSheets is — a Rust + WebAssembly spreadsheet engine that reads, edits and writes real .xlsx (Excel) files natively, on Node.js and in the browser.
---

# What is LogiSheets?

LogiSheets is a web-based spreadsheet engine, written in Rust and compiled to
WASM, that reads, manipulates and writes real `.xlsx` files. It runs natively
(Rust), on the server (Node.js) and in the browser.

What sets it apart from "just another spreadsheet library" is three design
goals:

### Excel compatibility

LogiSheets speaks `.xlsx` natively — formulas, styles, merged cells, multiple
sheets — so a workbook produced or edited by LogiSheets opens cleanly in Excel,
and a workbook authored in Excel loads without loss. You don't trade
compatibility for the features below; you get both.

### Structured data — the core idea

This is what LogiSheets is really about, and where it parts ways with a normal
spreadsheet.

A plain spreadsheet is a *loose grid of cells addressed by position*. That
position-addressing is the source of its most painful failure modes:

- **References break under edits.** Insert a row at the top and everything below
  shifts. Formulas, named ranges, and any external code that pointed at "row 12"
  are now silently pointing at the wrong data.
- **There is no notion of identity.** The cell `C5` is just a coordinate — the
  grid has no idea that `C5:F20` is "the line-items table" with columns
  *name / qty / price / total*. The structure lives only in the author's head.
- **You can't safely build on top of it.** Because a region has no stable handle
  and no declared shape, a plugin or an integration can't reliably read or write
  "the third field of the second row of that table."

LogiSheets fixes this at the data-model level with a single idea: a **Block** —
a region of the sheet with a **stable identity** and a coordinate space of its
own. That one property is load-bearing. Give a region an identity, and a whole
set of things a loose grid simply can't express all follow from it:

- **It survives edits.** The engine tracks a block's cells by stable IDs, so
  inserting or deleting rows elsewhere in the sheet leaves the block — and every
  reference into it — pointing at the right cells.
- **It can mean something.** Attach a **schema** — named fields, keys — and the
  block's contents carry *meaning*, not just a location: "the row keyed
  `2024-Q1`, field `revenue`" becomes an addressable thing, wherever the block
  currently sits.
- **It can be governed.** Because the region has a boundary and an owner, you can
  hang rules on it — which cells are inputs and which are computed, which ones the
  **user may edit**, what values are valid. A block is where a form's "only these
  fields are editable, and only with valid values" actually lives; a loose grid
  has nowhere to put that.
- **It can be built on.** A stable handle plus a declared shape is exactly what
  external code, the AI assistant, and other crafts need to read and write
  structured data reliably — by *(block, field, key)*, through the block payload
  family (`blockInput`, `insertRowsInBlock`, `bindFormSchema`, …).

These aren't four separate features — they're the same fact, *a region with
identity*, seen from four angles. The payoff: data in LogiSheets can be
*structured* — tables that know they're tables — while still living in a familiar,
Excel-compatible spreadsheet. This is the foundation everything else is built on.

### Easy to extend (built for secondary development)

LogiSheets is designed to be built *on*, not just used. The engine exposes a
rich, uniform API across every target — the same `Workbook` / `Worksheet`
concepts and the same transaction/payload edit model in Rust and TypeScript — so
you can drive it from a backend, a script, or a custom UI without fighting the
abstraction.

Blocks make this practical: because a region has a stable identity and a schema,
your own code can reliably read and write structured data inside a sheet. On top
of that, **Crafts** let you package custom behavior — an embedded form, a
what-if calculator, a domain-specific table — as a small application that lives
inside the spreadsheet. Whether you're embedding LogiSheets in a product or
extending it with plugins, the APIs are meant to make that straightforward.

In other words, LogiSheets is a faithful Excel engine, a structured-data model,
*and* a platform you can develop against.

## Three ways to use it

Depending on what you're building, you'll meet LogiSheets at one of three
levels. They build on each other — the engine wraps the SDK, and crafts build on
blocks.

### 1. As a plain spreadsheet library

Use the engine directly to read, edit and write `.xlsx`. Same core API across
three packages:

| Package | Language | Where it runs |
| --- | --- | --- |
| `logisheets-rs` | Rust | Native |
| `logisheets` | TypeScript (WASM) | Node.js |
| `logisheets-web` | TypeScript (WASM) | Browser |

You work with a `Workbook` and `Worksheet`, read cells, and apply edits as
batched **transactions**. This is the right level for file conversion, headless
report generation, server-side data processing, or wiring your own UI.

→ See **[Read & write spreadsheets (SDK)](/usage)** for the full API with Rust and TypeScript
examples.

### 2. As an online spreadsheet (`logisheets-engine`)

If you want a ready-made, interactive spreadsheet *in the browser* — selection,
scrolling, inline editing, sheet tabs, canvas rendering — use
**`logisheets-engine`**. It's a high-performance UI component built on top of
`logisheets-web`, using `OffscreenCanvas` and a Web Worker so editing and
rendering never block the main thread.

```bash
npm install logisheets-engine logisheets-web
```

You drive everything through a single `Engine` object — it owns the Web Worker
internally, so you never wire one up yourself. Construct it, wait for `ready`,
mount it into a DOM element, and load a file:

```ts
import {Engine} from 'logisheets-engine'
import 'logisheets-engine/style.css'

const engine = new Engine()
engine.on('ready', async () => {
    engine.mount(document.getElementById('spreadsheet')!)

    const buf = await fetch('workbook.xlsx').then(r => r.arrayBuffer())
    await engine.loadFile(new Uint8Array(buf), 'workbook.xlsx')
})
```

This is the right level when you want users to *use* a spreadsheet, not when you
want to script one.

→ See **[Embed the spreadsheet UI](/engine)** for the full integration guide.

### 3. Advanced: Blocks & Crafts

The deepest level is what makes LogiSheets more than a spreadsheet: building
**structured, programmable regions**.

- **Blocks** are rectangular regions identified by a stable ID rather than by
  cell coordinates. Cells inside a block keep their relative positions when rows
  or columns are inserted elsewhere in the sheet, and a block can carry a
  **schema** (named fields, keys) so its contents have meaning beyond "the cells
  at C3:F20". You manipulate blocks with the block payload family
  (`createBlock`, `blockInput`, `insertRowsInBlock`, `bindFormSchema`, …).

- **Crafts** are small applications that live inside LogiSheets. A craft is
  configured against a block and performs custom operations on its data — think
  of an embedded form, a what-if calculator, or a table extractor that the user
  interacts with right in the sheet. Crafts are how you extend the platform with
  domain-specific behavior.

#### Blocks are how crafts coexist

Crafts don't run in isolation. Several can operate on the same workbook, and they
often build on each other — one craft writes data another reads, the AI assistant
reads what a form craft produced, and the user keeps editing the sheet
throughout. If a craft addressed its data by raw position (`Sheet1!C5`), any of
those edits — a row inserted above, a column moved, another craft reshaping a
table — would silently shift the cells out from under it, and the next read would
return the wrong thing.

A **block** is the fix. A craft anchors its data to a block and addresses it by
**_(block, field, key)_** instead of a coordinate. Because the engine tracks a
block's cells by stable IDs, that address stays valid no matter what happens
elsewhere in the sheet. Blocks are the **reliable index** that lets crafts
cooperate — read and write each other's structured data — without stepping on one
another.

<figure class="block-craft">
<svg viewBox="0 0 760 320" role="img" aria-label="Two crafts read and write the same block by (block, field, key); the block has a stable ID and schema inside the sheet, so references stay valid as rows and columns shift." xmlns="http://www.w3.org/2000/svg">
  <style>
    .box   { fill: var(--vp-c-bg-soft); stroke: var(--vp-c-divider); stroke-width: 1.5; }
    .blk   { fill: var(--vp-c-bg-soft); stroke: var(--vp-c-brand-1); stroke-width: 2; }
    .sheet { fill: none; stroke: var(--vp-c-divider); stroke-width: 1.5; stroke-dasharray: 6 5; }
    .t     { fill: var(--vp-c-text-1); font: 600 14px var(--vp-font-family-base, sans-serif); }
    .s     { fill: var(--vp-c-text-2); font: 12px var(--vp-font-family-base, sans-serif); }
    .lbl   { fill: var(--vp-c-brand-1); font: 600 12px var(--vp-font-family-mono, ui-monospace, monospace); }
    .conn  { stroke: var(--vp-c-brand-1); stroke-width: 1.5; fill: none; opacity: 0.75; }
  </style>

  <!-- crafts -->
  <rect class="box" x="70" y="20" width="200" height="60" rx="10"/>
  <text class="t" x="170" y="46" text-anchor="middle">Craft A</text>
  <text class="s" x="170" y="66" text-anchor="middle">e.g. a budget form</text>

  <rect class="box" x="490" y="20" width="200" height="60" rx="10"/>
  <text class="t" x="590" y="46" text-anchor="middle">Craft B</text>
  <text class="s" x="590" y="66" text-anchor="middle">e.g. a report / the AI</text>

  <!-- connectors from crafts to the block -->
  <path class="conn" d="M170 80 C 170 150, 300 176, 350 206"/>
  <path class="conn" d="M590 80 C 590 150, 460 176, 410 206"/>
  <text class="lbl" x="196" y="140" text-anchor="middle">(block, field, key)</text>
  <text class="lbl" x="566" y="140" text-anchor="middle">(block, field, key)</text>

  <!-- sheet container -->
  <rect class="sheet" x="40" y="170" width="680" height="132" rx="10"/>
  <text class="s" x="58" y="192">Sheet — cells shift as rows / columns change</text>

  <!-- block -->
  <rect class="blk" x="280" y="206" width="200" height="82" rx="10"/>
  <text class="t" x="380" y="234" text-anchor="middle">Block #b1</text>
  <text class="s" x="380" y="254" text-anchor="middle">stable ID + schema</text>
  <text class="lbl" x="380" y="276" text-anchor="middle">name · qty · price</text>
</svg>
</figure>

Both crafts address the same block by _(block, field, key)_; rows and columns can
shift anywhere in the sheet and each keeps pointing at the right data.

This is where the *"from sheets to systems"* ambition becomes concrete. As an
example of how far a craft can go, try the **Factory Simulator**:

→ **[www.logisheets.com/?craft=factory-simulator](https://www.logisheets.com/?craft=factory-simulator)**

It's not a spreadsheet that happens to have some numbers in it — it's an
interactive simulation built *as a craft*, running inside an ordinary,
Excel-compatible workbook. That's the point: the same grid that opens your
`.xlsx` can also host a real application.

→ Start with the **[block payload reference](/usage#blocks-diy-cells-appendices-advanced)**
in the usage guide, then read the **[Craft system](/craft/craft)** for the
plugin model.

## Where to go next

- New to the engine? → **[Read & write spreadsheets (SDK)](/usage)**
- Want an interactive grid in a web app? → **[Embed the spreadsheet UI](/engine)**
- Building structured data or plugins? → **[Craft system](/craft/craft)**
