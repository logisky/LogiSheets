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

LogiSheets fixes this at the data-model level by introducing **Blocks**. A block
is a rectangular region that is addressed by a **stable ID**, not by
coordinates:

- **Cells inside a block keep their relative positions.** Insert or delete rows
  elsewhere in the sheet and the block — and every reference into it — stays
  correct. The engine tracks cells by stable IDs internally precisely so this
  holds.
- **A block can carry a schema** — named fields and keys — so its contents have
  *meaning*, not just a location. "Row whose key is `2024-Q1`, field `revenue`"
  becomes an addressable thing, independent of where the block currently sits.
- **Blocks have their own coordinate space and edit operations**
  (`blockInput`, `insertRowsInBlock`, `bindFormSchema`, …), so growing or
  reshaping a table doesn't disturb the rest of the sheet, and vice versa.

The payoff: data in LogiSheets can be *structured* — tables that know they're
tables — while still living in a familiar, Excel-compatible spreadsheet. This is
the foundation everything else is built on.

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
