---
description: Blocks give crafts a shared address to meet at, so crafts compose without knowing about each other — and an AI agent is what finally puts those combinations to use.
---

# Putting it together

You have now met both halves.

A **[block](/blocks)** is the noun: structured data with a name, fields and a
stable address. A **[craft](/craft/craft)** is the verb: logic that runs on the
sheet.

Either one alone is useful. Together they do something neither can do by
itself, and that is what this page is about.

## Crafts meet at blocks, not at each other

Here is the part worth slowing down for.

A craft never calls another craft. It writes a block, and some other craft
reads that block. Neither has to know the other exists.

That sounds like a small difference. It is the difference between a plugin
system that grows and one that collapses. If craft B had to call craft A, then
B would need A installed, would break when A changed its function signature,
and could never be written by someone who had not heard of A. Instead B only
needs to know that *somewhere there is a block called `line_items` with fields
`sku`, `qty`, `price`*. That is a much smaller thing to depend on, and it is
written in the file rather than in a README.

The block is the contract. Its name, its fields and its types are the whole
interface.

<figure class="block-craft">
<svg viewBox="0 0 760 320" role="img" aria-label="Two crafts read and write the same block by (block, field, key); the block has a stable ID and schema inside the sheet, so references stay valid as rows and columns shift." xmlns="http://www.w3.org/2000/svg">

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

This only works because the address is stable. If crafts pointed at `Sheet1!C5`,
then a row inserted by the user, a column moved by a third craft, or a sort
would quietly move the data out from under everyone. The whole arrangement
would last until the first edit. Addressing by *(block, field, key)* is what
makes it survive a real working document.

## What that buys you

A craft written on its own is worth one feature. A craft written on a block is
worth one feature **times every block it can read and every craft that can read
what it wrote**.

Say you have four small crafts, none of which knows about the others:

1. a table extractor that turns a pasted region into a block,
2. a validator that flags rows failing a rule,
3. a pricing model that adds a computed column,
4. a report builder that renders any block as a summary.

Nobody planned a pipeline. But extract → validate → price → report *is* a
pipeline, and so is extract → price → report, and so is validate → report. Each
new craft you add does not lengthen a list; it multiplies the number of chains
that already work.

This is the same reason Unix pipes outlived the programs in them. The
difference is that a block is typed and persistent: it is not a stream that
vanishes, it is a table that is still in the file tomorrow, with its schema
attached.

## The ceiling, and how AI removes it

There has always been a catch, and it is not technical.

Composition only happens when somebody *knows* it is possible. A person has to
know that craft 3 exists, that it works on the kind of data craft 1 produces,
and that running them in that order is the answer to the question they actually
have. Most people never find out. So the combinations exist in principle and go
unused in practice, and the plugin ecosystem ends up being a list of features
after all.

An agent does not have that problem. It can look:

- `list_blocks` and `describe_block` tell it what data is in the workbook, what
  the columns mean, and which rules are attached.
- `skills__discover` tells it which crafts are installed and what each is for.
- `skills__use` loads that craft's functions and calls them.

So the agent can see the pieces and put them together, which is exactly the
step that used to depend on a person happening to know. It can also make the
pieces: create a block, declare its schema, and then run a craft on it.

That is the real multiplication. The number of crafts grows slowly, by hand.
The number of *useful combinations of crafts* grows much faster than that — and
until now almost none of them were ever reached. What AI changes is not the
size of the toolbox. It is the fraction of the toolbox anyone actually uses.

## Why it holds together

Three things make this safe rather than merely clever, and you have already met
all of them:

- **The address is stable**, so a chain does not break when a person edits the
  sheet halfway through.
- **The rules are declared**, so a craft that writes nonsense into a block is
  flagged by the engine rather than discovered three steps later by the craft
  that read it.
- **The policies are explicit**, so a block that one craft owns cannot be
  quietly rewritten by another, and a person can fence off a column that nothing
  automated should touch.

Without those, "many crafts operating on shared data" is just a shared mutable
mess. With them, it is a workbook you can still open in Excel.

## Where to go next

- Write one → **[Write your own craft](/craft/writing-a-craft)**
- See how far a craft can go → **[Factory Simulator](https://www.logisheets.com/?craft=factory-simulator)**, an interactive simulation running inside an ordinary workbook
- Why any of this is the right shape → **[What is real AI-native?](/ideas/what-is-real-AI-native)**
