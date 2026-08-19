# logician

The **AI agent core for [LogiSheets](https://github.com/logisky/LogiSheets)** — a
platform-agnostic toolkit of LLM tools, prompts, and an agent loop for operating
spreadsheets through the LogiSheets engine. It powers **Watson**, the in-app AI
assistant, and is reusable from any host: the browser, a Node CLI, or an MCP
server.

`logician` is engine-neutral: it drives a workbook only through the
`WorkbookClient` surface from
[`logisheets-core`](https://www.npmjs.com/package/logisheets-core) /
[`logisheets-web`](https://www.npmjs.com/package/logisheets-web), so the same
agent runs in the browser and headless on Node.

> **Status:** internal to the LogiSheets monorepo (`private`), evolving. The API
> below is stable enough to build on but not yet semver-guaranteed.

## What's inside

- **Tool groups** — ready-made LLM tools grouped by capability, each a set of
  typed `Tool`s with JSON-schema inputs:
  - `INSPECT_TOOLS` — read the workbook (list blocks, describe a block, read a
    selection, evaluate a formula, explain why a cell is locked, …).
  - `EDIT_TOOLS` — mutate cells and blocks (set cells, add/delete block rows,
    checkpoint, preview changes, …).
  - `BUILDER_TOOLS` — higher-level authoring (create sheets and blocks, define
    field rules and enum sets, …).
  - `CRAFT_INTERACTION_TOOLS` — reach the host's craft overlay/widget state.
- **`ToolRegistry`** — register tools and emit them as Anthropic tool
  definitions (`toLlmTools()`).
- **`Agent`** — an end-to-end turn loop (`runTurn`) that drives an LLM ↔ tools
  cycle until the model finishes, with per-tool confirmation policies
  (`once` / `always` / `destructive`) for safe, human-in-the-loop editing.
- **Conversation store** — an event-sourced conversation model with adapters for
  Anthropic messages (`toLlmMessages`) and host UIs (`toUiBubbles`), plus an
  in-memory implementation.

## Usage

```ts
import {
    Agent,
    ToolRegistry,
    INSPECT_TOOLS,
    EDIT_TOOLS,
    BUILDER_TOOLS,
    MemoryConversationStore,
} from 'logisheets-logician'
import type {WorkbookClient} from 'logisheets-web'

declare const workbook: WorkbookClient // from the host (browser worker or Node)
declare const llm: LlmClient // your Anthropic client adapter

const registry = new ToolRegistry()
registry.registerMany([...INSPECT_TOOLS, ...EDIT_TOOLS, ...BUILDER_TOOLS])

const agent = new Agent({
    store: new MemoryConversationStore(),
    registry,
    llm,
    workbook,
    systemPrompt: 'You operate a LogiSheets workbook on the user\'s behalf.',
})

await agent.runTurn(conversationId, 'Add a Revenue column and total it.')
```

The `confirm` callback lets the host approve destructive or policy-gated tool
calls (the browser wires it to a modal; a CLI can prompt on stdin; headless hosts
auto-approve).

## Where it fits

```
logisheets-web / logisheets  (WASM engine)
            │  WorkbookClient
            ▼
      logisheets-core
            │
            ▼
        logician  ← LLM tools + agent loop
            │
   ┌────────┴─────────┐
Watson (browser)   Node CLI / MCP server
```

## License

MIT — part of the [LogiSheets](https://github.com/logisky/LogiSheets) project.
