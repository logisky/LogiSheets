---
description: A block is a region of a LogiSheets sheet with a stable identity and an optional schema, so data can be addressed as (block, field, key) instead of by cell coordinates.
---

# Blocks

A **block** is a rectangle of cells that knows it is a table.

That sounds small. It is the idea the rest of LogiSheets is built on, so this
page explains what it buys you and how to use it.

## The problem it solves

In a plain spreadsheet, a cell is a coordinate and nothing more. `C5` does not
know it belongs to the line-items table. The grid has no idea that `C5:F20` is
a table at all, or that its columns are *name / qty / price / total*. That
knowledge lives in the author's head.

Three things follow, and they are the reasons spreadsheets go wrong:

- **References break when the sheet changes.** Insert a row at the top and
  everything below shifts. A formula that pointed at row 12 now points at
  different data, and says nothing about it.
- **Ranges are easy to get wrong.** A range that covers too few rows looks
  exactly like a correct one.
- **Nothing can safely build on the sheet.** A script, an integration or an
  agent that wants "the third column of the second record" has to hard-code
  coordinates, and re-breaks every time a person edits the file.

## What a block is

A block is a region with a **stable identity**. The engine tracks its cells by
id rather than by position, so inserting or deleting rows elsewhere in the
sheet leaves the block — and every reference into it — pointing at the right
cells.

```ts
{type: 'createBlock', value: {
    sheetIdx: 0,
    id: 1,            // you choose the id and keep track of it
    masterRow: 0,     // where its top-left cell sits
    masterCol: 0,
    rowCnt: 100,
    colCnt: 4,
    owner: 'my-craft',
    description: 'Q1 line items',   // prose, for whoever reads the sheet next
}}
```

Cells inside a block are written **block-relative**, so the payload does not
care where the block currently sits:

```ts
{type: 'blockInput', value: {sheetIdx: 0, blockId: 1, row: 3, col: 1, input: '42'}}
```

## Giving it a schema

Identity alone survives edits. To make the contents *mean* something, bind a
schema: named fields, a key column, and what kind of value each field holds.

```ts
{type: 'bindFormSchema', value: {
    refName: 'line_items',   // the name formulas use
    sheetIdx: 0,
    blockId: 1,
    fieldFrom: 0,
    keyIdx: 0,               // fields[0] is the key column
    row: true,               // records run across rows
    headerIdx: 0,            // row 0 holds the column names, not a record
    fields: [
        {name: 'sku',   renderId: 'f0', fieldType: {kind: 'string'}, required: true, unique: true},
        {name: 'qty',   renderId: 'f1', fieldType: {kind: 'number'}, required: true},
        {name: 'price', renderId: 'f2', fieldType: {kind: 'number'}},
        {name: 'total', renderId: 'f3', fieldType: {kind: 'number'},
         valueFormula: '#FIELD("qty")*#FIELD("price")'},
    ],
}}
```

A few things worth knowing:

- **`headerIdx`** says which line holds the column names. That line is part of
  the block, so the heading travels with the table instead of being a stray row
  above it. Those cells are not editable and are never treated as a record.
- **`valueFormula`** makes a column engine-computed. Writes to it are dropped —
  the formula is the definition. `#FIELD("name")` reads a sibling cell in the
  same record; `#KEY` reads the record's key.
- **`renderId`** is a stable id per field. Nothing is stored against it; the
  engine keeps the column's number format under it, so it just has to be
  unique and stay put.

## Addressing by name

Once a block has a schema you stop naming cells and start naming data:

> the `price` field of the `SKU-001` record in the `line_items` block

In a formula that is:

```
=BLOCKREF("line_items", "SKU-001", "price")
```

This is the payoff. That address survives an inserted row, a sorted table, a
moved block, or a colleague reorganising the sheet — because it never referred
to a position in the first place. It is also what lets code and agents read and
write the sheet reliably.

## The operations you will actually use

| Payload | What it does |
| --- | --- |
| `createBlock` | Make a block. Reusing an existing id replaces the old one. |
| `bindFormSchema` | Attach or replace the schema. Anything you leave out is dropped, so send the whole field list every time. |
| `blockInput` | Write one cell, block-relative. |
| `insertRowsInBlock` / `deleteRowsInBlock` | Add or remove records. Columns have `insertColsInBlock` / `deleteColsInBlock`. |
| `reorderBlockLines` | Reorder records — this is how sorting is applied. |
| `moveBlock` / `resizeBlock` | Move the whole block, or change its size. |
| `removeBlock` | Delete the block, its schema and its cells. |
| `convertBlock` | Turn a plain range of cells that already holds a table into a block. |
| `setBlockDescription` | Rewrite the prose description. |
| `setBlockPermissions` | Change who may do what (below). |

Send a `createBlock` and its cell writes in **one transaction** — that way no
reader ever sees a half-built table, and one undo removes the whole thing.

Reads go through the client: `getAllBlocks({sheetIdx})` lists the blocks on a
sheet with their schemas, and `getBlockValues` reads their contents.

## Rules the engine checks for you

Declare what a field means and the engine generates the check. You do not write
the formula.

- `required` — the field may not be blank.
- `unique` — no two records may repeat a value here.
- `fieldType: {kind: 'enum', enumSetId}` — the value must be one of a named set
  (define it with `upsertEnumSet`).
- `fieldType: {kind: 'fieldRef', …}` — the value must exist in another block's
  field.
- `uniqueTogether: [{fields: ['region', 'quarter']}]` — a rule about the table
  rather than one column: this *combination* may not repeat. This catches the
  case where every individual cell is legal and the table is still wrong.

A record that breaks a rule still saves; it gets a warning marker. The person
sees that marker in the UI, and an agent gets the same list through
`list_violations`. One declaration, both audiences.

## Who may write

A block records an **owner** and a policy per operation (`cellInput`,
`insertDeleteLines`, `modifySchema`, `sortByField`, `removeBlock`, …). Each
resolves to one of:

| Policy | Who may act |
| --- | --- |
| `all` | anyone — the user, or any craft (small apps, covered next) |
| `ownerOnly` | only the block's owner |
| `ownerAndUser` | the owner and the person, but no other craft |

Fields can also carry their own `writePolicy`, and a per-record rule can lock
individual cells.

The engine only **decides**; the host enforces. A payload carries no record of
who sent it, so only the host knows whether an edit came from a person or a
craft. Ask `mayModifyBlock` rather than reading the policy yourself.

## Where to go next

- The full payload list → **[Read & write spreadsheets (SDK)](/usage#blocks-diy-cells-appendices-advanced)**
- Code that runs on top of a block → **[Crafts](/craft/craft)**
