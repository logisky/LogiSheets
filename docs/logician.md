---
description: logisheets-logician is the agent toolkit for LogiSheets — LLM tool definitions and an agent loop that drive a real workbook. It powers Watson, the in-app assistant, and logisheets-mcp.
---

# AI assistant (logician)

Everything up to here has been an API you call. This page is about letting a
model call it instead.

**`logisheets-logician`** is the agent toolkit: a set of LLM tool definitions
that operate a real workbook, plus a small agent loop to run them. It has no
host dependencies — you hand it a workbook client and an LLM client, and it
works the same in a browser tab or on a server.

Three things are built on it:

| | What it is |
| --- | --- |
| **Watson** | The assistant built into the LogiSheets web app. |
| **`logisheets-logician`** | The toolkit itself, for putting an agent in your own product. |
| **`logisheets-mcp`** | An MCP server, so Claude Desktop / Cursor / your own agent can drive a workbook. |

All three drive the same engine through the same tools. There is no separate
"AI backend".

## Install

```bash
npm install logisheets-logician
```

It depends on `logisheets-core` and `logisheets-web`, and deliberately **not**
on any LLM SDK. The loop defines the interface it needs and you inject a client
— so you can point it at Anthropic, at an OpenAI-compatible endpoint, or at
your own proxy without the toolkit knowing.

## Wiring it up

Four pieces: the tools, a registry, a conversation store, and an LLM client.

```ts
import {
    Agent,
    ToolRegistry,
    MemoryConversationStore,
    BUILDER_TOOLS,
    INSPECT_TOOLS,
    EDIT_TOOLS,
    CELL_TOOLS,
    FORMAT_TOOLS,
    STRUCTURE_TOOLS,
    HISTORY_TOOLS,
} from 'logisheets-logician'

const registry = new ToolRegistry()
registry.registerMany([
    ...BUILDER_TOOLS,
    ...INSPECT_TOOLS,
    ...EDIT_TOOLS,
    ...CELL_TOOLS,
    ...FORMAT_TOOLS,
    ...STRUCTURE_TOOLS,
    ...HISTORY_TOOLS,
])

const agent = new Agent({
    store: new MemoryConversationStore(),
    registry,
    workbook,          // your Client, browser WASM or Node
    llm: myLlmClient,  // see below
    systemPrompt: 'You are helping with a spreadsheet.',
})

await agent.runTurn('conversation-1', 'Total the revenue column by region.')
```

You choose which tool groups to register. A read-only reporting bot might take
`INSPECT_TOOLS` and `CELL_TOOLS` and nothing else; registering fewer tools is
the simplest way to bound what an agent can do.

Defaults worth knowing: `model` is `claude-opus-4-8`, `max_tokens` is 4096,
`max_tool_iterations` is 16, and `confirm` auto-approves — which you almost
certainly want to override (see below).

### The LLM client

One method. That is the whole interface:

```ts
interface LlmClient {
    createMessage(params: LlmCreateMessageParams): Promise<LlmResponse>
}
```

Wrap whichever SDK you use. The loop calls `registry.toLlmTools()` before every
request, so tools loaded mid-conversation become available immediately.

## What the tools cover

Tools are grouped into namespaces, and an LLM sees each as `namespace__name`
(`build__create_block`, `inspect__list_violations`).

| Namespace | For |
| --- | --- |
| `build` | Blocks and schemas: create, describe, rename, add and delete rows, field rules, analyses and pivots. |
| `inspect` | Read-only: `list_violations`, `why_locked`, `trace`, the user's current selection. |
| `edit` | Writes addressed by `(block, row_key, field)`, plus `preview_changes` and `goal_seek`. |
| `cell` | Plain cells by coordinate: get, set, clear, fill. |
| `format` | Styling, merging, the format painter. |
| `sheet` | Rows, columns, sheet add / delete / rename. |
| `chart` | Suggest, insert, update and delete charts. |
| `comment` | Threaded comments — an agent's notes are attributed to the assistant. |
| `history` | Undo and redo. |
| `skills` | `discover` and `use` — find installed crafts and load their tools at runtime. |

Three of these do most of the work in practice, and they are worth calling out
because they are what make an agent correctable rather than merely capable:

- **`build__describe_block`** reads a block's schema back — field types, rules,
  computed columns. State lives in the workbook, not in the context window, so
  a conversation can end and the next one picks up where it left off.
- **`inspect__list_violations`** reports every cell that currently fails its
  rule, in plain language. An agent can call it after a batch of writes and fix
  what it got wrong in the same turn.
- **`inspect__why_locked`** explains why a particular cell cannot be written to
  — engine-computed, an editability rule, or a key column. Always a reason,
  never a bare refusal.

## Keeping a person in the loop

Every tool declares whether it **mutates** the workbook, and carries a
confirmation policy: `never`, `once`, `always`, or `destructive`. When a tool
does not set one, the loop uses `mutates ? 'always' : 'never'` — so reads run
freely and writes ask by default.

```ts
const agent = new Agent({
    // …
    confirm: async (message, detail) => ({
        approved: await showModal(message, detail),
    }),
})
```

Declining is recorded and returned to the model as the tool's result, so the
agent knows it was refused rather than silently failing.

Two more safety rails are ordinary workbook features rather than AI ones:
`edit__preview_changes` dry-runs a set of edits and reports what they would do,
and `build__checkpoint` takes a snapshot to roll back to. Undo works on an
agent's turn exactly as it works on yours.

## Watson

**Watson** is the assistant in the web app. It is this toolkit plus an
Anthropic-wire LLM client, a browser conversation store, and a confirmation
modal.

A **craft** can extend what Watson is able to do. Annotate an exported function
with JSDoc — `@logicianSkill` once for the craft, `@tool` per function, plus
`@mutates` and `@confirm` — and the `craftsmith` CLI turns it into a manifest
Watson reads. `skills__discover` lists installed crafts; `skills__use` loads
one's functions into the live registry, so they are callable on the next step.

One implementation then serves your UI, a headless runtime, and the assistant.
See **[Write your own craft](/craft/writing-a-craft)**.

## Over MCP

**[`logisheets-mcp`](https://github.com/logisky/logisheets-mcp)** exposes the
engine over the Model Context Protocol, so any MCP host gets a real spreadsheet
to compute in — Claude Desktop, Cursor, or an agent you wrote yourself.

It runs on your machine over stdio, and the workbook never has to leave it. By
default it offers a curated subset of the tools above rather than all of them,
which keeps the tool list small enough to be useful in a host's context window;
an environment variable opens up the full set.

## Where to go next

- The data model an agent is actually addressing → **[Blocks](/blocks)**
- Giving the assistant new abilities → **[Write your own craft](/craft/writing-a-craft)**
- Why the same design serves people and agents → **[What is real AI-native?](/ideas/what-is-real-AI-native)**
