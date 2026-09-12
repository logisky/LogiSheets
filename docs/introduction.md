---
description: LogiSheets is a Rust + WebAssembly spreadsheet engine that reads and writes real .xlsx files — and writes down the structure of a sheet, so that people and AI agents can work in the same document.
---

# What is LogiSheets?

LogiSheets is a spreadsheet engine written in Rust and compiled to WebAssembly.
It reads, edits and writes real `.xlsx` files, and the same engine runs in the
browser, on Node.js, and natively in Rust.

That part is ordinary. Here is the part that is not.

## Where AI and people work together

A spreadsheet is the most widely understood tool people have for working with
data. It is also a bad thing to hand a machine.

Everything that makes a sheet readable to a person is a habit, kept in their
head. Where the table starts and stops. That the first row is headings. That
column D is a percentage, and the empty rows at the bottom are padding rather
than missing data. A person takes all of this in at a glance and never thinks
about it again.

A model sees none of it. Give an agent a plain grid and it has to guess the
structure, then act on the guess. When the guess is wrong nothing breaks — you
get a believable number in a believable cell, and somebody finds out weeks
later.

LogiSheets writes those habits into the file, so one document works for both
readers:

- The **person** sees an ordinary grid, and gets a real `.xlsx`.
- The **agent** sees tables it can name, columns whose type and meaning it can
  read back, rows it can address by key, rules that say when a value is wrong,
  and limits on what it may change.

There is no separate "AI copy" of the data, and no chat box bolted to the side.
It is one file with enough structure written down that both can work in it.
That structure is a **[block](/blocks)**, and everything else here is built on
it.

An agent reaches the engine three ways, all of them the same API underneath:

- **Watson**, the assistant built into the web app.
- **`logisheets-logician`**, the agent toolkit — tool definitions that drive a
  real workbook. No host dependencies, so it runs in the browser or on Node.
- **[`logisheets-mcp`](https://github.com/logisky/logisheets-mcp)**, which puts
  the engine behind the Model Context Protocol for Claude Desktop, Cursor, or
  your own agent.

## What else is different

### It really is Excel

LogiSheets speaks `.xlsx` natively — formulas, styles, merged cells, several
sheets. A file it writes opens cleanly in Excel, and a file Excel wrote loads
without losing anything. You do not trade compatibility for the features below.
You get both.

### Blocks: tables that know they are tables

In a plain spreadsheet a cell is only a coordinate. `C5` does not know it
belongs to the line-items table, so a formula pointing at it breaks the moment
somebody inserts a row.

A **block** is a region of the sheet with a stable identity, and optionally a
**schema** — named columns, a key column, declared types. Once a region has
those, you stop addressing cells and start addressing data: *the `revenue`
field of the `2024-Q1` row of the `income_statement` block*. That address
survives every insert, delete and sort.

→ **[Blocks](/blocks)**

### Crafts: small apps that live in the sheet

A spreadsheet is generic; your work is not. A **craft** is a small application
that runs inside LogiSheets — a pricing form, a what-if calculator, a
simulator. You write the logic once and it reaches the browser UI, a headless
runtime, and the AI assistant.

→ **[Crafts](/craft/craft)**

## Three ways to use it

The three build on each other, so pick the lowest one that does your job.

### 1. As a spreadsheet library

Read, edit and write `.xlsx` from code. The same core API in three packages:

| Package | Language | Where it runs |
| --- | --- | --- |
| `logisheets-rs` | Rust | Native |
| `logisheets` | TypeScript (WASM) | Node.js |
| `logisheets-web` | TypeScript (WASM) | Browser |

You work with a `Workbook` and `Worksheet`, read cells, and send edits as
batched **transactions**. Right for file conversion, report generation,
server-side processing, or driving your own UI.

→ **[Read & write Excel files](/usage)**

### 2. As a spreadsheet in a web page

If you want a working grid in the browser — selection, scrolling, editing,
sheet tabs — use **`logisheets-engine`**. It is a canvas UI built on
`logisheets-web`, using `OffscreenCanvas` and a Web Worker so rendering never
blocks the page.

```bash
npm install logisheets-engine logisheets-web
```

```ts
import {Engine} from 'logisheets-engine'
import 'logisheets-engine/style.css'

const engine = new Engine()
engine.on('ready', async () => {
    engine.mount(document.getElementById('spreadsheet')!)

    const buf = await fetch('workbook.xlsx').then((r) => r.arrayBuffer())
    await engine.loadFile(new Uint8Array(buf), 'workbook.xlsx')
})
```

→ **[Add a spreadsheet UI](/engine)**

### 3. With blocks and crafts

This is the level that makes LogiSheets more than a grid: structured regions
your own code, your crafts, and an agent can all read and write reliably.

→ **[Blocks](/blocks)** and **[Crafts](/craft/craft)**

## Where to go next

- New to the engine? → **[Read & write Excel files](/usage)**
- Want a grid in a web app? → **[Add a spreadsheet UI](/engine)**
- Storing real data in a sheet? → **[Blocks](/blocks)**
- Building a feature on top? → **[Crafts](/craft/craft)**
- How those two combine → **[Putting it together](/composition)**
