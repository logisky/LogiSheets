/**
 * Turning the block definitions into a workbook.
 *
 * Pure: it emits payloads and answers "where is this field", and touches no
 * client. That is what lets the same code build the real game and build the
 * one the tests assert against.
 */

import {BLOCKS, DRAFT_ROUNDS, ELEMENTS, SLOTS, type BlockDef} from './sheet'
import {enumSetPayloads, enumSetOf, fieldLabel, type SheetLocale} from './i18n'

/**
 * Blank rows between stacked blocks.
 *
 * Sized by the block CHROME, not by taste. The hover header hangs 72px above a
 * block (title bar + field names) and the add-row handle ~30px below it, so at
 * the default 20px row that is a bit over five rows of overhang. At a smaller
 * gap the overlays overlap their neighbour's body, and because they take
 * pointer events they swallow its hover: you aim at one block and light up the
 * one above.
 */
const GAP = 6

/**
 * Every block carries its field names as a real first line, declared to the
 * schema with `headerIdx`.
 *
 * Without it a column is only named while the pointer is on the block, and the
 * chrome that names it is drawn 72px ABOVE the block — so on a tall table like
 * `deck` you hover the middle and get no title and no field names at all. A
 * header line is part of the block, travels with it, and is simply readable.
 * The engine leaves it out of the records, so `BLOCKREFS(...,"*",...)` and key
 * lookups are unaffected.
 */
const HEADER_ROWS = 1

export interface Placement {
    /** Row of the block's HEADER line; data starts at `row + HEADER_ROWS`. */
    row: number
    /** Field name → column offset from the block's master column. */
    cols: Map<string, number>
}

/** Where every block sits. Derived from the table sizes, never hardcoded. */
export function layout(
    blocks: readonly BlockDef[] = BLOCKS
): Map<string, Placement> {
    const at = new Map<string, Placement>()
    // Starts at GAP, not 0: the first block's header would otherwise be
    // clipped against the column-header row and never appear.
    let row = GAP
    for (const b of blocks) {
        at.set(b.ref, {
            row,
            cols: new Map(b.fields.map((f, i) => [f.name, i])),
        })
        row += HEADER_ROWS + b.rows.length + GAP
    }
    return at
}

export const PLACEMENT = layout()

/** The cell one field of one row occupies. */
export function cellOf(
    ref: string,
    key: string | number,
    field: string,
    blocks: readonly BlockDef[] = BLOCKS
): {row: number; col: number} {
    const place = PLACEMENT.get(ref)
    const block = blocks.find((b) => b.ref === ref)
    if (!place || !block) throw new Error(`no block "${ref}"`)
    const rowIdx = block.rows.findIndex((r) => String(r[0]) === String(key))
    if (rowIdx < 0) throw new Error(`block "${ref}" has no row keyed "${key}"`)
    const col = place.cols.get(field)
    if (col === undefined)
        throw new Error(`block "${ref}" has no field "${field}"`)
    return {row: place.row + HEADER_ROWS + rowIdx, col}
}

/** Default column width, in the engine's ~1-character units (x7 = px). */
const DEFAULT_COL_WIDTH = 8.43
/** Default row height. The header line gets more, to read as a heading. */
const HEADER_ROW_HEIGHT = 22

/**
 * How wide each column has to be, in characters.
 *
 * Columns are a property of the SHEET, not of a block, and all ten blocks
 * start at column 0 — so column A has to fit `water>water` from `counter`,
 * `element` from `hand` and both `knob` names at once. Widest wins, which is
 * why the knob keys are kept short: one long key would pad the column for
 * every other block on the sheet.
 */
export function colWidths(blocks: readonly BlockDef[] = BLOCKS): number[] {
    const chars: number[] = []
    const note = (ci: number, text: string) =>
        (chars[ci] = Math.max(chars[ci] ?? 0, text.length))
    for (const b of blocks) {
        b.fields.forEach((f, ci) => note(ci, f.name))
        b.rows.forEach((r) => r.forEach((v, ci) => note(ci, String(v))))
        // Cells the craft fills in later are blank in the seeds, so the
        // widest thing they will ever hold has to be allowed for here.
        b.fields.forEach((_, ci) => note(ci, RUNTIME_WIDEST))
    }
    // +2 for the cell's own padding, and never narrower than the default.
    return chars.map((n) => Math.max(DEFAULT_COL_WIDTH, n + 2))
}

/** The longest value any cell takes on during a game. */
const RUNTIME_WIDEST = [
    ...ELEMENTS,
    'triple',
    'chain',
    'split',
    'none',
    'draft',
    'play',
    'done',
].reduce((a, b) => (b.length > a.length ? b : a))

/**
 * Every payload that builds the game, in one list for one transaction.
 *
 * Block order is load-bearing twice over: `bindFormSchema` folds
 * `BLOCKREF("X", …)` into stable ids at parse time, so a block must come after
 * everything its formulas name; and seed values are written before the bind so
 * a `#KEY` template resolves against a key that exists.
 */
export function setupPayloads(
    sheetIdx: number,
    blocks: readonly BlockDef[] = BLOCKS,
    locale: SheetLocale = 'en'
): unknown[] {
    const place = layout(blocks)
    // The option lists first: a field naming a set the workbook does not have
    // yet is a field with no options.
    const out: unknown[] = [...enumSetPayloads(locale)]
    // Once for the sheet, before the blocks: a column too narrow to show
    // `youCancelled` or `water>water` makes the table unreadable, and the
    // field names are the whole point of the header line.
    colWidths(blocks).forEach((width, col) =>
        out.push({type: 'setColWidth', value: {sheetIdx, col, width}})
    )
    blocks.forEach((b, i) => {
        const {row} = place.get(b.ref)!
        out.push({
            type: 'createBlock',
            value: {
                sheetIdx,
                id: i + 1,
                masterRow: row,
                masterCol: 0,
                rowCnt: HEADER_ROWS + b.rows.length,
                colCnt: b.fields.length,
            },
        })
        // The header line, then the records below it. Header text is the
        // LABEL, not the field name — the name is what formulas key on and
        // never changes; this is the half a person reads.
        b.fields.forEach((f, ci) =>
            out.push({
                type: 'cellInput',
                value: {
                    sheetIdx,
                    row,
                    col: ci,
                    content: fieldLabel(f.name, locale),
                },
            })
        )
        b.rows.forEach((r, ri) =>
            r.forEach((v, ci) => {
                if (v === '') return
                out.push({
                    type: 'cellInput',
                    value: {
                        sheetIdx,
                        row: row + HEADER_ROWS + ri,
                        col: ci,
                        content: String(v),
                    },
                })
            })
        )
        out.push({
            type: 'bindFormSchema',
            value: {
                refName: b.ref,
                sheetIdx,
                blockId: i + 1,
                fieldFrom: 0,
                keyIdx: 0,
                row: true,
                headerIdx: 0,
                fields: b.fields.map((f, fi) => {
                    const set = enumSetOf(b.ref, f.name)
                    return {
                        name: f.name,
                        renderId: `${b.ref}:${fi}`,
                        ...(f.valueFormula
                            ? {valueFormula: f.valueFormula}
                            : {}),
                        ...(f.description ? {description: f.description} : {}),
                        ...(set
                            ? {fieldType: {kind: 'enum', enumSetId: set}}
                            : {}),
                    }
                }),
            },
        })
        out.push({
            type: 'setRowHeight',
            value: {sheetIdx, row, height: HEADER_ROW_HEIGHT},
        })
        // Bold through the BLOCK's own line index, not the sheet row, so the
        // heading stays a heading if the block ever moves.
        out.push({
            type: 'blockLineStyleUpdate',
            value: {
                sheetIdx,
                blockId: i + 1,
                from: 0,
                to: 0,
                row: true,
                ty: {setFontBold: true},
            },
        })
        // Prose, after the bind so the block exists to carry it. The stored
        // formulas cannot say what they read — `#FIELD` materialises to A1 —
        // so this and the field descriptions are the whole explanation a
        // reader, or an agent, gets.
        if (b.description)
            out.push({
                type: 'setBlockDescription',
                value: {sheetIdx, blockId: i + 1, description: b.description},
            })
    })
    return out
}

/**
 * Clearing a finished game without rebuilding it.
 *
 * Only the cells a game writes: every other cell is a rule the player may have
 * edited, and re-dealing is not a reason to take those edits away.
 */
export function resetPayloads(sheetIdx: number): unknown[] {
    // `cellClear`, not an empty `cellInput`: the latter writes a blank value
    // the dependent formulas then read as neither a card nor "".
    const clear = (ref: string, key: string | number, field: string) => ({
        type: 'cellClear',
        value: {sheetIdx, ...cellOf(ref, key, field)},
    })
    const out: unknown[] = []
    for (let round = 1; round <= DRAFT_ROUNDS; round++)
        for (const field of ['youPick', 'aiPick'])
            out.push(clear('draft', round, field))
    for (let slot = 1; slot <= SLOTS; slot++)
        for (const field of ['you', 'ai']) out.push(clear('play', slot, field))
    return out
}

/**
 * Switch the sheet's language, without touching a single game value.
 *
 * Only two things on the sheet are in a language: the header line's text and
 * the enum labels. Neither is a key and neither is read by a formula, so this
 * is safe in the middle of a game — which is the point, because the user can
 * change language whenever they like.
 */
export function relabelPayloads(
    sheetIdx: number,
    locale: SheetLocale,
    blocks: readonly BlockDef[] = BLOCKS
): unknown[] {
    const place = layout(blocks)
    const out: unknown[] = [...enumSetPayloads(locale)]
    for (const b of blocks) {
        const {row} = place.get(b.ref)!
        b.fields.forEach((f, ci) =>
            out.push({
                type: 'cellInput',
                value: {
                    sheetIdx,
                    row,
                    col: ci,
                    content: fieldLabel(f.name, locale),
                },
            })
        )
    }
    return out
}

/** One card into one cell. The craft's only write during a game. */
export function writePayload(
    sheetIdx: number,
    ref: string,
    key: string | number,
    field: string,
    content: string
): unknown {
    const {row, col} = cellOf(ref, key, field)
    return {type: 'cellInput', value: {sheetIdx, row, col, content}}
}

/** A shuffled deck, as the payloads that seed it. Fisher–Yates over `rand`. */
export function shufflePayloads(
    sheetIdx: number,
    elements: readonly string[],
    count: number,
    rand: () => number = Math.random
): unknown[] {
    // As even a mix as the count allows — 15 cards over 4 elements is 4/4/4/3.
    // The draft should turn on order and reading, not on one element being
    // scarce by accident.
    const pool: string[] = []
    while (pool.length < count)
        pool.push(elements[pool.length % elements.length])
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool.map((card, i) =>
        writePayload(sheetIdx, 'deck', i + 1, 'card', card)
    )
}
