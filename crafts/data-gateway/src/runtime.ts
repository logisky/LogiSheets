// data-gateway runtime — the headless face of the craft.
//
// A host (the Node `logisheets-runtime`) loads this module for any workbook
// whose AppData carries data-gateway state, then drives it around each
// JSON-RPC exchange:
//
//   onLoad      resolve the declaration against the live workbook: install a
//               validation shadow on every declared cell and record which
//               blocks a request may read / write.
//   onRequest   an incoming request's inputs are about to be applied — reject
//               it if it names a block outside the allowed read/write sets.
//   onValidate  inputs are now in place; re-check every validation rule and
//               return the cells that fail, BEFORE any response is read.
//   onResponse  the response is about to be returned (hook for output reads).
//
// The workbook handle `W` is host-bound (logisheets-core keeps it generic); we
// only need its engine-neutral operation layer (`ops`) and raw client
// (`client`), so we pin `W` to a minimal structural type that both the Node
// runtime's `Workbook` and any equivalent host satisfy.

import type {
    CraftRuntime,
    ValidationRule,
    WorkbookOps,
    Client,
} from 'logisheets-core'
import type {SheetCellId, CellCoordinateWithSheet} from 'logisheets-web'
import {
    normalizeState,
    type DataGatewayState,
    type ValidationEntry,
} from './state'

/**
 * The workbook handle the runtime binds to: the host's engine-neutral
 * operation layer (`ops`) plus its raw client (`client`). We bind to the REAL
 * `WorkbookOps` / `Client` from logisheets-core — not a local structural copy —
 * so the Node runtime's `Workbook` (which is exactly `{ops, client, ...}`)
 * satisfies it, and any drift in the `WorkbookOps` methods we call (or the
 * client methods) surfaces here at compile time instead of silently.
 */
export interface GatewayWorkbook {
    readonly ops: WorkbookOps
    readonly client: Client
}

/** One installed validation: the shadow's id (cached at load) plus the target
 * rule, kept only so a failing cell can be reported with coords + formula. */
export interface InstalledValidation {
    readonly shadow: SheetCellId
    readonly rule: ValidationRule
}

/** What the runtime remembers per workbook after {@link onLoad}. */
export interface GatewayRecord {
    /** Blocks (refName) a request may write. */
    readonly inputBlocks: ReadonlySet<string>
    /** Blocks (refName) a request may read. */
    readonly outputBlocks: ReadonlySet<string>
    /**
     * The installed validations, each holding the shadow id returned by
     * `setValidationRule`. `onValidate` reads the verdicts straight back by
     * these ids — no state re-parse, no cell-id re-resolution.
     */
    readonly validations: readonly InstalledValidation[]
}

// Per-workbook records, keyed by the workbook handle's identity so a runtime
// hosting many workbooks keeps each gateway's allowed-block sets separate.
const records = new WeakMap<object, GatewayRecord>()

/** The gateway record for a workbook, or undefined if it never loaded one. */
export function getGatewayRecord(
    wb: GatewayWorkbook
): GatewayRecord | undefined {
    return records.get(wb)
}

/**
 * Convention for how a request declares the blocks it touches. A request may
 * carry `{params: {dataGateway: {readBlocks?, writeBlocks?}}}`; the runtime
 * checks those names against the allowed sets. A request that declares nothing
 * is assumed to touch no blocks (and so passes) — the gateway can only enforce
 * what a request tells it.
 */
export interface RequestBlockDeclaration {
    readBlocks?: string[]
    writeBlocks?: string[]
}

function readDeclaration(params: unknown): RequestBlockDeclaration {
    if (!params || typeof params !== 'object') return {}
    const dg = (params as Record<string, unknown>).dataGateway
    if (!dg || typeof dg !== 'object') return {}
    const r = dg as Record<string, unknown>
    return {
        readBlocks: Array.isArray(r.readBlocks)
            ? r.readBlocks.filter((b): b is string => typeof b === 'string')
            : undefined,
        writeBlocks: Array.isArray(r.writeBlocks)
            ? r.writeBlocks.filter((b): b is string => typeof b === 'string')
            : undefined,
    }
}

function isErrorMessage(v: unknown): v is {msg: string} {
    return (
        typeof v === 'object' &&
        v !== null &&
        'msg' in (v as Record<string, unknown>)
    )
}

/**
 * Resolve each declared validation entry against the live workbook: the stable
 * (sheetId, cellId) it was authored on maps to a current (sheetIdx, row, col).
 * Entries whose sheet or cell no longer exists are dropped — a rule on a
 * deleted cell simply stops applying. Called once from {@link onLoad}; the
 * resolved rules are saved on the {@link GatewayRecord} and reused thereafter.
 */
async function resolveRules(
    state: DataGatewayState,
    wb: GatewayWorkbook
): Promise<ValidationRule[]> {
    if (state.validations.length === 0) return []

    // Resolve sheetId -> sheetIdx once per distinct sheet.
    const sheetIdxBySheetId = new Map<number, number>()
    for (const v of state.validations) {
        if (sheetIdxBySheetId.has(v.sheetId)) continue
        const idx = await wb.client.getSheetIdx({sheetId: v.sheetId})
        if (isErrorMessage(idx)) continue
        sheetIdxBySheetId.set(v.sheetId, idx as number)
    }

    // Batch coordinate lookups for every (sheetId, cellId), keeping the entry
    // alongside each id so we can pair results back up.
    const pending: {entry: ValidationEntry; id: SheetCellId}[] = []
    for (const entry of state.validations) {
        if (!sheetIdxBySheetId.has(entry.sheetId)) continue
        pending.push({
            entry,
            id: {sheetId: entry.sheetId, cellId: entry.cellId},
        })
    }
    if (pending.length === 0) return []

    const coords = await wb.client.batchGetCellCoordinateWithSheetById({
        ids: pending.map((p) => p.id),
    })
    if (isErrorMessage(coords)) return []
    const list = coords as readonly CellCoordinateWithSheet[]

    const rules: ValidationRule[] = []
    for (let i = 0; i < pending.length; i++) {
        const coord = list[i]
        if (!coord) continue
        const sheetIdx = sheetIdxBySheetId.get(pending[i].entry.sheetId)
        if (sheetIdx === undefined) continue
        rules.push({
            sheetIdx,
            row: coord.coordinate.y,
            col: coord.coordinate.x,
            formula: pending[i].entry.formula,
        })
    }
    return rules
}

/**
 * The data-gateway {@link CraftRuntime}. Exported as the module default so a
 * host's craft loader (which imports the module and reads its default export)
 * picks it up directly.
 */
export const runtime: CraftRuntime<DataGatewayState, GatewayWorkbook> = {
    async onLoad(s, wb) {
        const state = normalizeState(s)

        // Resolve every rule's stable cellId to a live coordinate ONCE, install
        // its validation shadow, and cache the shadow id the install returns.
        // A single failing cell shouldn't disable the whole gateway, so per-rule
        // failures are skipped rather than aborting.
        const rules = await resolveRules(state, wb)
        const validations: InstalledValidation[] = []
        for (const rule of rules) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const shadow = await wb.ops.setValidationRule(
                    rule.sheetIdx,
                    rule.row,
                    rule.col,
                    rule.formula
                )
                validations.push({shadow, rule})
            } catch {
                /* skip a cell we couldn't attach to */
            }
        }

        records.set(wb, {
            inputBlocks: new Set(state.inputBlocks),
            outputBlocks: new Set(state.outputBlocks),
            validations,
        })
        return undefined
    },

    onRequest(req, s, wb) {
        const record = records.get(wb)
        const inputs =
            record?.inputBlocks ?? new Set(normalizeState(s).inputBlocks)
        const outputs =
            record?.outputBlocks ?? new Set(normalizeState(s).outputBlocks)

        const decl = readDeclaration(req.params)
        const disallowedWrites = (decl.writeBlocks ?? []).filter(
            (b) => !inputs.has(b)
        )
        const disallowedReads = (decl.readBlocks ?? []).filter(
            (b) => !outputs.has(b)
        )
        if (disallowedWrites.length || disallowedReads.length) {
            const parts: string[] = []
            if (disallowedWrites.length)
                parts.push(`write not allowed: ${disallowedWrites.join(', ')}`)
            if (disallowedReads.length)
                parts.push(`read not allowed: ${disallowedReads.join(', ')}`)
            return {msg: `data-gateway: ${parts.join('; ')}`, ty: 0}
        }
        return undefined
    },

    onValidate(_s, wb) {
        // Read the verdicts straight back by the shadow ids cached at load —
        // one batched read, no re-parse, no cell-id re-resolution.
        const validations = records.get(wb)?.validations ?? []
        return wb.ops.checkValidationShadows(validations)
    },

    onResponse() {
        // The response is developer-defined and already gated at request time;
        // nothing to enforce here yet. Kept as an explicit hook so a future
        // version can read output blocks back for the caller.
        return undefined
    },
}

export default runtime
