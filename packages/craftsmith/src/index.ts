/**
 * logisheets-craftsmith — programmatic API (the `craftsmith` CLI is ./cli.ts).
 *
 * Main exports: `extract` (craft dir → manifest + diagnostics, no writes, no
 * code execution), `resolveCraft` (file-convention discovery), `typeToSchema`
 * (the TS type → JSON Schema mapper the tool contract is built on), and the
 * manifest / diagnostic types.
 *
 * The manifest shape here is the producer side of a wire contract: logician
 * reads `dist/manifest.json` through its own mirrored copy of these types
 * (packages/logician/src/crafts/manifest.ts — keep the two in sync), and the
 * app's craft store serves it to Watson. Craft authors import types from the
 * `logisheets-craftsmith/authoring` subpath (authoring.d.ts), not from here.
 */
export {extract, resolveCraft} from './extract.js'
export type {ExtractResult, CraftPaths} from './extract.js'
export {typeToSchema} from './schema.js'
export type {Diagnostic, DiagnosticLevel} from './diagnostics.js'
export {SchemaError} from './diagnostics.js'
export type {
    CraftManifest,
    ManifestTool,
    ManifestSkill,
    JSONSchema,
    MutatesPolicy,
    ConfirmationPolicy,
} from './manifest.js'
