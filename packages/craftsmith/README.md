# craftsmith

CLI for LogiSheets **crafts** — scaffold, validate, build and pack a craft, and
generate the **capability manifest** that the built-in AI assistant (Watson /
`logician`) reads to discover a craft's skill and invoke its tools.

The full design and rationale live in
[docs/craft/craftsmith.md](../../docs/craft/craftsmith.md).

## Commands

```
craftsmith check [dir]     Validate a craft (conventions + tool contract). No writes.
craftsmith build [dir]     Validate, compile tools.ts/runtime.ts, emit dist/manifest.json.
craftsmith pack  [dir]     Tarball dist/ into <craftId>-<version>.tgz.
craftsmith new   <name>    Scaffold a new craft directory.
```

## File conventions

| File | Role |
| --- | --- |
| `tools.ts` | Every `@tool` function. Pure (ambient-free). The capability surface. |
| `runtime.ts` | *Optional.* `CraftRuntime` lifecycle hooks → the manifest's `rtJs`. |
| `index.html` | *Optional.* The craft's page → the manifest's `url`. |
| `package.json` | Identity: `craftId`, `version`, `label`. |

## Annotations (JSDoc — read statically, no runtime decorators)

```ts
import type {SkillCtx} from 'logisheets-craftsmith/authoring'

/**
 * @logicianSkill What this craft is good at and when Watson should use it.
 * @guidance Optional prompt fragment injected once Watson picks this craft.
 */

/**
 * @tool One-line description the model uses to decide when to call.
 * @param row  Zero-based row index.
 * @mutates true          // none | temp | true   (default: none)
 * @confirm always        // never | once | always | destructive  (default: never / always-if-mutates)
 */
export async function writeGreeting(ctx: SkillCtx, row: number, text: string) { … }
```

The first parameter is always the host-injected `ctx` and is excluded from the
tool's input schema. Natural signatures — `craftsmith` reads parameter names and
types from the TypeScript type checker and synthesizes `inputSchema` /
`paramOrder`; the return type becomes `outputSchema`. `check` rejects anything
that can't become the contract: non-serializable types, missing `ctx`,
non-exported tools, top-level side effects or DOM globals in `tools.ts`.

`dist/manifest.json` is a pure build artifact — generated, never hand-edited,
and not committed (it lives under gitignored `dist/` and only ships in the built
package). The CI gate is `craftsmith check`, which validates the contract
statically and fails on any error.
