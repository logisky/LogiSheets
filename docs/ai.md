---
description: How LogiSheets makes one spreadsheet legible to both a person and an AI agent — semantic (block, field, key) addressing, declarations an agent can read back, validation that tells it when it is wrong, comment threads both parties write in, and write policies that fence the two apart.
---

# AI and humans, same document

A spreadsheet is the most widely understood interface humans have for
structured data. It is also close to the worst interface you could hand a
model.

Everything that makes a sheet readable to a person is a **convention** — held
in their head, written down nowhere. Where the table starts and stops. That the
first row is headings and not data. That column D is a percentage, that the
blank rows at the bottom are padding rather than missing records, that the
figure in F12 is a subtotal and must not be edited. A person absorbs all of
that at a glance and never thinks about it again.

A model gets none of it. Handed a raw grid, it has to infer the structure and
then act on the inference — and when the inference is wrong the result is not a
crash. It is a plausible number in a plausible cell, found three weeks later by
someone who trusted the total.

LogiSheets is built so that the conventions live **in the document**, where
both readers can see them. The person still sees an ordinary grid and still
gets a real `.xlsx`. The agent sees something it can actually reason about.

## What an agent needs that a grid can't give it

### 1. An address that survives editing

An agent working in coordinates is tracking a moving target. Insert a row, sort
a column, let the user delete something — and `C7` quietly means something
else.

In LogiSheets an agent addresses data the way it already thinks about it:

> *Set the `revenue` field of the `2024` record in the `income_statement`
> block.*

That is **`(block, field, key)`**, resolved through stable cell IDs. It stays
correct across inserts, deletes, sorts, and anything the person does in the
meantime. The agent never has to know where the block currently sits, and never
has to re-locate it after an edit.

This is the largest single difference, because it removes a class of failure
rather than mitigating it. See
[Structured data](/introduction#structured-data-%E2%80%94-the-core-idea) for the block
model itself.

### 2. Declarations it can read back

An agent's context window is lossy short-term memory. Anything it must remember
for more than a few steps has to live somewhere else.

Here it lives in the workbook. A block's schema records what an agent
declared — field names and types, descriptions, `required` and `unique`
constraints, enum sets, references to other blocks, computed columns, and which
analyses derive from it — and `describe_block` reads it back.

Worth stating plainly: **the structure is state, not prompt.** It survives the
conversation ending, the file being saved and reopened, and a different agent
picking the work up next week. A workbook an agent built is one it can resume,
because the meaning went into the file alongside the numbers.

### 3. To be told when it is wrong

Plausible-but-wrong is only dangerous because nothing pushes back. So the
engine pushes back.

Rules are **derived from declarations**, not written by hand. Declaring a field
`required`, or `unique`, or an enum, or a reference into another block makes
the engine generate the validation for it. A block can also state a rule about
*itself*: `unique_together` says a combination of fields may not repeat — the
case where every individual cell is legal and the table is still wrong, which
is exactly the mistake an agent makes when filling a fact table. A repeated
`(region, quarter)` is an error nowhere, and it makes every total over it count
twice.

Two tools close the loop:

- **`list_violations`** — every cell that currently fails its rule, with the
  reason named in plain language (`required`, `unique together with (region,
  quarter)`, `must exist in …`). An agent can call it after a batch of writes
  and fix what it got wrong in the same turn.
- **`why_locked`** — why one specific cell cannot be written to: it is
  engine-computed, or its editability rule evaluates false for this record, or
  it is a key column. Always a reason, never a bare refusal.

The same rules drive the warning markers the human sees in the UI. One
definition, both audiences.

### 4. Boundaries, in both directions

A shared document has to say who may change what — and "human" and "agent" are
not the only two parties. A block carries a **modify policy** per operation
(`cellInput`, `insertDeleteLines`, `modifySchema`, `sortByField`,
`removeBlock`, …), each resolving to one of:

| Policy | Who may act |
| --- | --- |
| `all` | anyone — the user or any craft |
| `ownerOnly` | only the block's owner |
| `ownerAndUser` | the owner **and the person**, but no other craft |

So a human can fence an agent out of a column it should not be rewriting, and
an automated table can stay automated while the person keeps access to it.
Fields carry their own `writePolicy` on top of that, and a per-record
editability rule can lock individual cells.

The subtler case is `overrideValidation`, deliberately kept separate from
`cellInput`. The two answer different questions: *may this actor write here at
all*, versus *may this actor write something the schema says is wrong*. A craft
maintaining a table often has to seed a row it knows is incomplete — a required
field it fills in on the next pass — while a person typing into that same block
should be held to the rule. Different actors, different latitude, same
document.

The engine only ever **decides**; hosts enforce. That keeps one answer to "who
may do this" across the browser app, the headless runtime, and every craft,
instead of each host inventing its own.

## Talking to each other in the document

The parts above let an agent work in the sheet. These let the two parties
address each other in it, rather than in a chat log that gets closed.

- **Comment threads.** `add_comment`, `reply_comment` and `resolve_comment`
  operate the same threaded comments a person uses — and an agent's notes are
  attributed to the assistant, not disguised as the user's. It can flag a
  number it isn't sure about on the cell itself; the person can reply there;
  either can resolve the thread. These are OOXML threaded comments, so they
  survive into Excel.
- **Prose on the block.** `set_block_description` writes an explanation of what
  a table is for onto the block, persisted in the file. It is how one agent
  tells the next one — or the person — what this thing is, in the one place
  neither can miss.
- **Knowing what the person is looking at.** `get_active_selection` returns the
  user's current selection with its block, record and field context, so "what
  about this one?" resolves to an actual address instead of a guess.

## The human stays in control

Every tool declares whether it **mutates** the workbook, and carries a
confirmation policy — `never`, `once`, `always`, or `destructive`. A mutating
tool defaults to asking, so a host can let reads run freely and gate writes
behind the user, with deletions marked out for a stronger prompt. Declining is
recorded and returned to the model as the tool's result, so the agent knows it
was refused and why.

Around that:

- **`preview_changes`** dry-runs a set of edits and reports what they would do,
  without committing them.
- **`checkpoint`** takes an engine-managed snapshot to roll back to, which
  matters for long multi-step builds.
- **`undo` / `redo`** are ordinary workbook history. An agent's turn is not a
  special kind of change that a person cannot reverse.

## Deterministic arithmetic

Models are unreliable at arithmetic and reliable at deciding what to compute.
LogiSheets splits the work along that line.

An agent does not hand back a number it worked out. It declares an
**analysis** — an aggregate over a field, or a pivot with row and column
dimensions — and the engine lowers that to real formulas and evaluates them.
The values stay live: when a source record changes, the total changes, with no
agent in the loop at all.

The result is a genuine Excel construction, too. A pivot built this way is
written into the saved `.xlsx` as an actual pivot table wherever the shape
allows it, so the person who opens the file in Excel gets something they can
use rather than a grid of frozen numbers.

## The artifact is the point

Everything above serves a document a person keeps.

An agent working in a code sandbox produces a throwaway result: the script
runs, prints a number, and the reasoning evaporates. What LogiSheets produces
is a real `.xlsx` — opens in Excel, auditable cell by cell, editable by hand,
still correct months later. The person can check the work, change an input and
watch the totals move, or ignore the agent entirely and use it as a
spreadsheet.

That is what common ground means here. Not a chat panel beside a grid, and not
a special AI-readable export kept in sync with the real file. One document,
structured enough that both parties can work in it.

## How to reach it

### In the app — Watson

**Watson** is the built-in assistant in the LogiSheets web app. It drives the
workbook through the toolkit below, so everything on this page applies to it
directly.

A **craft** can extend what Watson is able to do: annotate a function with
JSDoc — `@logicianSkill` for what the craft is for, `@tool` per function, plus
`@mutates` and `@confirm` — and the [`craftsmith`](/craft/writing-a-craft) CLI
turns it into a capability manifest the assistant reads. One implementation
serves your UI, a headless runtime, and the AI. See
[Craft system](/craft/craft).

### From any agent host — `logisheets-logician`

```bash
npm install logisheets-logician
```

`logisheets-logician` is the platform-agnostic agent toolkit: more than seventy
tool definitions grouped into namespaces (`build`, `inspect`, `edit`, `cell`,
`format`, `sheet`, `chart`, `comment`, `link`, `history`, and more), plus the
prompts, skills, and an agent loop.

It has no host dependencies. You inject a `Client` (browser WASM or Node), the
same way [`logisheets-core`](/introduction#_1-as-a-plain-spreadsheet-library)
does, and bring your own LLM client — the loop defines the interface it needs
rather than importing a vendor SDK.

### Over MCP

[`logisheets-mcp`](https://github.com/logisky/logisheets-mcp) exposes the
engine over the Model Context Protocol, so any MCP host — Claude Desktop,
Cursor, or your own agent — gets a real spreadsheet to compute in and remember
in. It runs on your machine and the workbook never has to leave it.

## Where to go next

- The data model everything here rests on → **[Structured data](/introduction#structured-data-%E2%80%94-the-core-idea)**
- Driving the engine yourself → **[Read & write spreadsheets (SDK)](/usage)**
- Giving the assistant new capabilities → **[Write your own craft](/craft/writing-a-craft)**
