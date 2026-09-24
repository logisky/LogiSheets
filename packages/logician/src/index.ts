/**
 * logisheets-logician — the agent toolkit for LogiSheets.
 *
 * LLM tool definitions that drive a real workbook, plus the small,
 * provider-neutral runtime needed to run them. It owns no UI, no storage
 * backend, no LLM SDK and no system prompt: a host supplies those.
 *
 * What is in here:
 *   - `Tool` / `ToolRegistry` / `toLlmTool` (tool.ts): the tool contract and
 *     the registry the agent dispatches through. LLM-facing ids are
 *     `${namespace}__${name}`.
 *   - Built-in tool bundles, one array per area, which a host registers
 *     wholesale: `BUILDER_TOOLS`, `INSPECT_TOOLS`, `EDIT_TOOLS`, `CELL_TOOLS`,
 *     `FORMAT_TOOLS`, `STRUCTURE_TOOLS`, `HISTORY_TOOLS`, `COMMENT_TOOLS`,
 *     `NAME_TOOLS`, `BLOCK_OPS_TOOLS`, `LINK_TOOLS`, `CHART_TOOLS`,
 *     `CRAFT_INTERACTION_TOOLS`. Committed writes refuse while a temp branch
 *     is open (tools/temp-branch.ts).
 *   - `Agent` (agent/loop.ts): the LLM <-> tools loop over an append-only
 *     event stream (`ConversationEvent`, conversation.ts) persisted through a
 *     host `ConversationStore` (storage.ts), projected to LLM messages / chat
 *     bubbles by projection.ts. The host provides the `LlmClient`.
 *   - `askAi` (craft-ai.ts): the stateless, read-only craft -> model call.
 *   - Crafts: `CraftManifest` mirrors what `packages/craftsmith` extracts from
 *     a craft's `@tool` / `@logicianSkill` / `@aiRole` annotations;
 *     `makeCraftSkillTools` / `installCraftSkillTools` expose installed crafts
 *     to the model through `skills__discover` / `skills__use`.
 *   - `CraftInteractionsApi` (+ `createCoreCraftInteractions` for in-process
 *     hosts): overlay widgets the craft-interaction tools program against.
 *
 * Siblings:
 *   - The workbook is a `logisheets-web` `Client` (`WorkbookClient`); tools
 *     import only `logisheets-web/pure`, never the wasm entry. Pivot payload
 *     sequences and the craft-interaction singletons come from
 *     `logisheets-core`, which also backs the browser app.
 *   - Watson (src/components/watson in the app) registers these bundles, wires
 *     an IndexedDB store, a confirm modal and craft stores. The standalone
 *     logisheets-mcp repo exposes the same tools over MCP.
 *
 * Builds: the `node` export condition resolves to `dist/index.node.js`, an
 * esbuild bundle that inlines `logisheets-web/pure` and keeps
 * `logisheets-core` (and `logisheets`) external; every other condition gets
 * the plain `tsc` output, which imports `logisheets-web/pure` at runtime.
 */
export * from './tool.js'
export * from './craft-interactions-api.js'
export * from './craft-interactions-core.js'
export * from './tools/builder.js'
export * from './tools/inspect.js'
export * from './tools/edit.js'
export * from './tools/cells.js'
export * from './tools/format.js'
export * from './tools/structure.js'
export * from './tools/history.js'
export * from './tools/comments.js'
export * from './tools/names.js'
export * from './tools/block-ops.js'
export * from './tools/effect.js'
export * from './tools/temp-branch.js'
export * from './tools/links.js'
export * from './tools/charts.js'
export * from './tools/taxonomy.js'
export * from './tools/craft-interactions.js'
export * from './craft-ai.js'
export * from './crafts/manifest.js'
export * from './crafts/store.js'
export * from './crafts/skill-tools.js'
export * from './conversation.js'
export * from './storage.js'
export * from './projection.js'
export * from './agent/loop.js'
