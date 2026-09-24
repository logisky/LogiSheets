/**
 * Defined-name tools — workbook-scoped named ranges and constants
 * (`Sales` → `Sheet1!$B$2:$B$100`, `TaxRate` → `0.08`). A formula uses a
 * name like a reference: `=SUM(Sales)*TaxRate`.
 *
 * Names are case-insensitive. Renaming one rewrites nothing: formulas hold the
 * name itself, so they follow the rename. Deleting one leaves its users at
 * `#NAME?` until it is defined again.
 */

import {isErrorMessage} from 'logisheets-web/pure'
import type {
    Client,
    DefinedNameInfo,
    EditPayload,
    Transaction,
} from 'logisheets-web/pure'
import type {Tool, ToolContext} from '../tool.js'
import {transactionFailure} from './effect.js'
import {assertScratchBranchFree} from './temp-branch.js'

function asClient(ctx: ToolContext): Client {
    return ctx.workbook as Client
}

async function commit(
    client: Client,
    payload: EditPayload,
    label: string
): Promise<void> {
    await assertScratchBranchFree(client, label)
    const tx: Transaction = {payloads: [payload], undoable: true, temp: false}
    const r = await client.handleTransaction({transaction: tx})
    if (isErrorMessage(r)) throw new Error(`${label}: ${r.msg}`)
    if (r.status.type === 'err') throw transactionFailure(label, r)
}

async function readNames(client: Client): Promise<readonly DefinedNameInfo[]> {
    const res = await client.getDefinedNames()
    if (isErrorMessage(res)) throw new Error(`defined names: ${res.msg}`)
    return res
}

function findName(
    names: readonly DefinedNameInfo[],
    name: string
): DefinedNameInfo | undefined {
    const upper = name.trim().toUpperCase()
    return names.find((n) => n.name.toUpperCase() === upper)
}

// ---------------------------------------------------------------------------

export const listNames: Tool<Record<string, never>, unknown> = {
    namespace: 'name',
    name: 'list_names',
    description:
        'List the workbook\'s defined names (named ranges and named constants). Each has a name and what it refers to, sheet-qualified (e.g. "Sheet1!$B$2:$B$20" or "0.08"). A formula can use any of them as a reference: =SUM(Sales).',
    mutates: false,
    confirmation: 'never',
    inputSchema: {properties: {}, required: []},
    handler: async (_input, ctx) => {
        const names = await readNames(asClient(ctx))
        return {
            data: {
                names: names.map((n) => ({name: n.name, refersTo: n.formula})),
            },
            display: `${names.length} defined name(s)`,
        }
    },
}

export const defineName: Tool<
    {name: string; refersTo: string; sheetIdx?: number},
    {name: string; refersTo: string; replaced: boolean}
> = {
    namespace: 'name',
    name: 'define_name',
    description:
        'Create a defined name, or replace what an existing one refers to. refersTo is written like a formula without "=": a range ("Sheet1!$B$2:$B$20"), a cell, a constant ("0.08"), or an expression ("Sheet1!$A$1*12"). Prefer sheet-qualified absolute references; an unqualified one is read against sheetIdx (default 0). Names start with a letter or "_", use letters, digits, "_" and ".", and must not look like a cell reference (A1, R1C1). Existing formulas that already use the name recalculate immediately.',
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            name: {type: 'string', description: 'e.g. "Sales", "TaxRate".'},
            refersTo: {
                type: 'string',
                description: 'e.g. "Sheet1!$B$2:$B$20" or "0.08".',
            },
            sheetIdx: {
                type: 'integer',
                description:
                    'Sheet that unqualified references in refersTo belong to. Default 0.',
            },
        },
        required: ['name', 'refersTo'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)
        const replaced = !!findName(await readNames(client), input.name)
        await commit(
            client,
            {
                type: 'defineName',
                value: {
                    name: input.name,
                    formula: input.refersTo,
                    sheetIdx: input.sheetIdx ?? 0,
                },
            },
            'define_name'
        )
        // Read back the stored form: it is what formulas will actually see.
        const stored = findName(await readNames(client), input.name)
        const refersTo = stored?.formula ?? input.refersTo
        return {
            data: {name: stored?.name ?? input.name, refersTo, replaced},
            display: `${replaced ? 'Redefined' : 'Defined'} ${
                input.name
            } = ${refersTo}`,
        }
    },
}

export const renameName: Tool<{oldName: string; newName: string}, {ok: true}> =
    {
        namespace: 'name',
        name: 'rename_name',
        description:
            'Rename a defined name. Formulas using it follow the rename automatically; nothing needs rewriting. Fails if another defined name already has newName.',
        mutates: true,
        confirmation: 'always',
        inputSchema: {
            properties: {
                oldName: {type: 'string'},
                newName: {type: 'string'},
            },
            required: ['oldName', 'newName'],
        },
        handler: async (input, ctx) => {
            await commit(
                asClient(ctx),
                {type: 'renameName', value: input},
                'rename_name'
            )
            return {
                data: {ok: true},
                display: `Renamed ${input.oldName} → ${input.newName}`,
            }
        },
    }

export const deleteName: Tool<{name: string}, {ok: true}> = {
    namespace: 'name',
    name: 'delete_name',
    description:
        'Delete a defined name. Formulas that still use it show #NAME? until it is defined again, so check name__list_names and the formulas first.',
    mutates: true,
    confirmation: 'destructive',
    inputSchema: {
        properties: {name: {type: 'string'}},
        required: ['name'],
    },
    handler: async (input, ctx) => {
        await commit(
            asClient(ctx),
            {type: 'removeName', value: {name: input.name}},
            'delete_name'
        )
        return {data: {ok: true}, display: `Deleted ${input.name}`}
    },
}

export const NAME_TOOLS: Tool[] = [
    listNames as Tool,
    defineName as Tool,
    renameName as Tool,
    deleteName as Tool,
]
