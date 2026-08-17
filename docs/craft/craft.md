---
description: A craft turns a LogiSheets spreadsheet into an app for your business — one piece of logic you write once and reach from the browser, a headless runtime, and AI.
---

# Craft

`Craft` is a core concept of `LogiSheets`.

> **A craft is one piece of logic that can run in three places — in the
> browser, in a headless runtime, and as an AI capability — from a single
> implementation.**

## What a craft gives you

A spreadsheet is generic. Your work isn't. A **craft** is how you teach
LogiSheets *your* domain: you write the specific logic your business needs — a
pricing model, a data validator, a what-if analysis, an inventory simulator, a
custom input tool — and it becomes a first-class feature of the sheet.

- **Build for a concrete workflow.** Instead of forcing users to remember which
  cells and formulas to touch, give them a button, a form, or a game board that
  *does the thing* — correctly, every time.
- **Your logic, not ours.** A craft is your code operating on the workbook
  through its public API. You decide what it does; the platform provides the
  sheet, the UI surface, the persistence, and the AI.
- **Convenient for the people using it.** The craft encodes the know-how, so the
  end user just clicks (or asks the AI) — no spreadsheet expertise required.

The crafts already in the repo hint at the range: `what-if-calculator` (preview
changes before committing), `markdown-table-extractor` (turn a selection into a
table), `sudoku` / `minesweeper` / `fuse-beads` (interactive boards), and
data-gateway-style validators. Each is a small app for one job.

## One logic, three faces

The reason a craft is worth writing once is that a single implementation reaches
every surface. You write the logic (plain functions that operate on the
workbook), then add a **thin interface** for each surface you want:

- an **`index.html`** to give it a UI in the browser,
- a few **conventional functions** to run it headless in a runtime,
- some **JSDoc** to expose it to the AI assistant.

None of these re-implement the logic — they're thin adapters over the same core.

<figure class="craft-faces">
<svg viewBox="0 0 760 300" role="img" aria-label="A craft's shared logic reached through three thin interfaces: index.html for the browser, conventional functions for the runtime, and JSDoc for AI." xmlns="http://www.w3.org/2000/svg">
  <style>
    .box  { fill: var(--vp-c-bg-soft); stroke: var(--vp-c-divider); stroke-width: 1.5; }
    .core { fill: var(--vp-c-bg-soft); stroke: var(--vp-c-brand-1); stroke-width: 2; }
    .t    { fill: var(--vp-c-text-1); font: 600 14px var(--vp-font-family-base, sans-serif); }
    .s    { fill: var(--vp-c-text-2); font: 12px var(--vp-font-family-base, sans-serif); }
    .lbl  { fill: var(--vp-c-brand-1); font: 600 12.5px var(--vp-font-family-mono, ui-monospace, monospace); }
    .conn { stroke: var(--vp-c-brand-1); stroke-width: 1.5; fill: none; opacity: 0.7; }
  </style>

  <!-- core -->
  <rect class="core" x="24" y="110" width="200" height="80" rx="10"/>
  <text class="t" x="124" y="142" text-anchor="middle">Craft logic</text>
  <text class="s" x="124" y="162" text-anchor="middle">pure functions,</text>
  <text class="s" x="124" y="177" text-anchor="middle">written once</text>

  <!-- connectors -->
  <path class="conn" d="M224 135 C 360 135, 380 55, 520 55"/>
  <path class="conn" d="M224 150 C 380 150, 400 150, 520 150"/>
  <path class="conn" d="M224 165 C 360 165, 380 245, 520 245"/>

  <!-- adapter labels on the connectors -->
  <text class="lbl" x="372" y="78"  text-anchor="middle">index.html</text>
  <text class="lbl" x="372" y="142" text-anchor="middle">runtime.ts</text>
  <text class="lbl" x="372" y="238" text-anchor="middle">tools.ts + JSDoc</text>

  <!-- browser face -->
  <rect class="box" x="520" y="24" width="216" height="66" rx="10"/>
  <text class="t" x="628" y="52" text-anchor="middle">Browser</text>
  <text class="s" x="628" y="72" text-anchor="middle">interactive panel (iframe)</text>

  <!-- runtime face -->
  <rect class="box" x="520" y="119" width="216" height="66" rx="10"/>
  <text class="t" x="628" y="147" text-anchor="middle">Runtime</text>
  <text class="s" x="628" y="167" text-anchor="middle">headless: Node, server, validation</text>

  <!-- ai face -->
  <rect class="box" x="520" y="214" width="216" height="66" rx="10"/>
  <text class="t" x="628" y="242" text-anchor="middle">AI (Watson)</text>
  <text class="s" x="628" y="262" text-anchor="middle">discovers &amp; calls your tools</text>
</svg>
</figure>

Each face is optional — implement only the ones your craft needs. A game is
UI-only; a data validator is runtime-only; most crafts pick two or three.

- **Browser** — a standalone package loaded in a same-origin `<iframe>` in the
  craft panel. The host injects capabilities onto the craft's `window`
  (read/write the sheet, listen to canvas input, persist state, …), and your
  `index.html` is the UI that calls your logic.
- **Runtime** — the same logic can run **without any UI**: conventional
  functions the platform calls headlessly, e.g. to validate an edit before it
  commits, or to run in Node or the collaboration server.
- **AI (Watson)** — annotate your functions with JSDoc and the `craftsmith` CLI
  turns them into a capability manifest the built-in AI assistant uses to
  discover your craft and call it. The manifest is generated from your code, so
  it can never drift.

## One implementation, no drift

The point of the thin-interface design: **the exact function your button calls
is the function the runtime calls is the function Watson calls.** There is no
separate "tool layer" and no duplicated logic to keep in sync — a craft *is* the
logic, and the browser / runtime / AI are just ways to reach it.

## Get started

➡️ **[Write your own craft](./writing-a-craft.md)** — scaffold with the
`craftsmith` CLI, then the guide walks the host API, the common patterns, the
gotchas, and how to expose your craft's functions as AI tools.

```bash
npx craftsmith new my-craft
cd my-craft && npm install
npx craftsmith check .     # validate the contract
npx craftsmith build .     # compile → dist/
```
