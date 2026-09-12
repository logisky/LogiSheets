---
description: A hands-on walkthrough — build a block, bind a schema, read it back, reference it from formulas, add rules, and sort it, with the mistakes that cost people an afternoon.
---

# Structure data with blocks

[Blocks](/blocks) explained what a block is. This page builds one.

We will make a small line-items table, give it a schema, reference it from a
formula, add a rule, and break that rule on purpose to see what happens. Every
snippet is TypeScript; the Rust API has the same payloads under the same names.

## 1. Create it and fill it, in one transaction

A block and its contents should land together. If you create the block in one
transaction and write the cells in another, anything reading in between sees an
empty table — and it takes two undos to get rid of.

```ts
const blockId = wb.getAvailableBlockId({sheetIdx: 0})

const rows = [
    ['SKU-001', '3', '19.99'],
    ['SKU-002', '1', '249.00'],
    ['SKU-003', '12', '4.50'],
]

const payloads = [
    {type: 'createBlock', value: {
        sheetIdx: 0,
        id: blockId,
        masterRow: 0,
        masterCol: 0,
        rowCnt: rows.length + 1,   // + 1 for the header line
        colCnt: 4,
        owner: 'my-app',
        description: 'Q1 line items',
    }},
    // the header line
    ...['sku', 'qty', 'price', 'total'].map((name, col) => ({
        type: 'blockInput' as const,
        value: {sheetIdx: 0, blockId, row: 0, col, input: name},
    })),
    // the records
    ...rows.flatMap((r, i) =>
        r.map((input, col) => ({
            type: 'blockInput' as const,
            value: {sheetIdx: 0, blockId, row: i + 1, col, input},
        }))
    ),
]

const effect = wb.execTransaction({payloads, undoable: true, temp: false})
if (effect.status.type === 'err') throw new Error('block not created')
```

Two things to notice.

`blockInput` uses **block-relative** coordinates. `row: 0` is the block's first
line, not the sheet's. That is why none of this code cares where the block
sits, and why moving the block later breaks nothing.

Nothing writes column 3 (`total`). That column is about to become computed.

## 2. Bind a schema

Identity alone survives edits. A schema makes the contents mean something.

```ts
wb.execTransaction({
    payloads: [{type: 'bindFormSchema', value: {
        refName: 'line_items',
        sheetIdx: 0,
        blockId,
        fieldFrom: 0,
        keyIdx: 0,        // fields[0] is the key column
        row: true,        // records run across rows
        headerIdx: 0,     // line 0 is column names, not a record
        fields: [
            {name: 'sku', renderId: 'f0', fieldType: {kind: 'string'},
             required: true, unique: true},
            {name: 'qty', renderId: 'f1', fieldType: {kind: 'number'},
             required: true},
            {name: 'price', renderId: 'f2', fieldType: {kind: 'number'}},
            {name: 'total', renderId: 'f3', fieldType: {kind: 'number'},
             valueFormula: '#FIELD("qty")*#FIELD("price")'},
        ],
    }}],
    undoable: true,
    temp: false,
})
```

`total` now fills itself: 59.97, 249.00, 54.00. Writes to it are dropped,
because the formula is the definition.

`headerIdx: 0` is what makes line 0 a heading rather than a record. Those cells
become read-only, no rule is applied to them, and — the reason it is on the
schema and not somewhere else — the heading travels with the block when it
moves.

## 3. Read it back

```ts
const blocks = wb.getAllBlocks({sheetIdx: 0})
const me = blocks.find((b) => b.blockId === blockId)

me.schema.name                       // 'line_items'
me.schema.fields.map((f) => f.field) // ['sku', 'qty', 'price', 'total']
me.rowCnt                            // 4  (header + 3 records)
```

This matters more than it looks. Whatever you declared, you can read back — so
a later run of your code, a different craft, or an agent does not have to be
told what the table is. It is written in the file.

## 4. Point a formula at it

```ts
{type: 'cellInput', value: {sheetIdx: 0, row: 10, col: 0,
    content: '=BLOCKREF("line_items", "SKU-002", "total")'}}
```

Insert rows above the block, sort it, move it to another corner of the sheet:
that formula keeps returning SKU-002's total, because it never referred to a
position.

## 5. Add a rule and break it

`sku` was declared `required` and `unique`. Add one about the table as a whole
by re-binding with `uniqueTogether`:

```ts
uniqueTogether: [{fields: ['sku', 'qty']}]
```

Now write a value that breaks a rule — blank out a `qty`:

```ts
wb.execTransaction({
    payloads: [{type: 'blockInput', value: {sheetIdx: 0, blockId, row: 1, col: 1, input: ''}}],
    undoable: true,
    temp: false,
})
```

The write **succeeds**. The cell gets a warning marker, which a person sees in
the UI and an agent gets from `list_violations`. That is deliberate: a rule
that refused the write would make it impossible to seed a row you intend to
finish later.

The exception is the **key column**. A duplicate key is refused outright rather
than flagged, because a repeated key makes records unreachable. Writing one
fails the whole transaction — so if a batch of yours is being rejected for no
visible reason, check for a repeated key first.

## 6. Add, remove and sort records

```ts
// three more records after the existing ones
{type: 'insertRowsInBlock', value: {sheetIdx: 0, blockId, idx: 3, cnt: 3}}

// drop the second record
{type: 'deleteRowsInBlock', value: {sheetIdx: 0, blockId, idx: 1, cnt: 1}}
```

Sorting is two steps, because the engine computes the order and you apply it:

```ts
const order = wb.getBlockSortOrder({sheetIdx: 0, blockId, field: 'price', asc: false})
wb.execTransaction({
    payloads: [{type: 'reorderBlockLines', value: {sheetIdx: 0, blockId, ...order}}],
    undoable: true,
    temp: false,
})
```

The sort is typed — numbers sort as numbers, not as text — and the declared
header line stays on top.

## Mistakes that cost an afternoon

**A `blockInput` outside the block fails the entire transaction.** It is not
ignored. If you shrink a block and keep writing the old column count, every
payload in that batch is rejected, including the good ones.

**`bindFormSchema` replaces, it does not merge.** Anything you leave out of
`fields` is dropped — a type, a rule, a `valueFormula`. When changing one
field, send the whole list. Read the current schema with `getAllBlocks` first
if you do not have it.

**Reusing a block id replaces the block.** `createBlock` with an id that
already exists removes the old one, with its schema and its cells. Get ids from
`getAvailableBlockId`.

**The header line counts toward `rowCnt`.** A table with a header and 100
records is `rowCnt: 101`. Off by one here and your last record is outside the
block, which brings you back to the first mistake.

**Do not resize a block after binding its schema.** Generated formulas are
installed during the bind; a later resize leaves the new cells uncomputed.
Resize first, then bind.

## Where to go next

- The full payload list → **[Read & write Excel files](/usage#blocks-diy-cells-appendices-advanced)**
- Wrapping this in something users can click → **[Write your own craft](/craft/writing-a-craft)**
- Letting a model do it → **[AI assistant (logician)](/logician)**
