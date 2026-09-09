import {useEffect, useRef, useState} from 'react'
import {observer} from 'mobx-react-lite'
import {toast} from 'react-toastify'
import {globalStore} from '@/store'
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Tooltip,
    Typography,
} from '@mui/material'
import {ContextMenu, ContextMenuItem} from '@/ui/context-menu'
import {
    Settings as SettingsIcon,
    Add as AddIcon,
    ArrowUpward as ArrowUpwardIcon,
    ArrowDownward as ArrowDownwardIcon,
    Functions as FunctionsIcon,
    RuleOutlined as RuleIcon,
    Refresh as RefreshIcon,
    ErrorOutline as ErrorOutlineIcon,
} from '@mui/icons-material'
import {
    Grid,
    BlockManager,
    isErrorMessage,
    xForColStart,
    xForColEnd,
    yForRowStart,
    yForRowEnd,
} from 'logisheets-engine'
import {ZINDEX_BLOCK_OUTLINER} from '../const'
import {MenuComponent} from './menu'
import {BlockComposerComponent} from '@/components/block-composer'
import {useEngine, useOps, useDataService} from '@/core/engine/provider'
import type {FieldInfo} from 'logisheets-engine'
import {projectBlockFields} from '@/core/blocks/field-projection'
import {
    BlockCellInfo,
    BlockDisplayInfo,
    BlockInfo,
    BlockSchemaFieldEntry,
    PivotSpecParts,
} from 'logisheets-engine'
import type {
    AggFunc,
    AnalysisSource,
    DimOrder,
    PivotSource,
    WorkbookOps,
} from 'logisheets-core'
import {FieldRuleDialog} from './field-rule-dialog'
import {PivotDialog, type PivotSpecChoice} from './pivot-dialog'
import type {FieldRuleKind} from '@/components/block-composer/field-formula'
import {LeftTop} from '@/core/settings'
import {BlockCellProps, RenderedCellSpec, buildRenderedCells} from './cell'
import {EnumCell} from './enum-cell'
import {BoolCell} from './bool-cell'
import {ValidationCell} from './validation-cell'
import {RequiredCell} from './required-cell'
import {DatetimeCell} from './datetime-cell'
import {ImageCell} from './image'
import {FieldRefCell} from './field-ref-cell'
import {MultiFieldRefCell} from './multi-field-ref-cell'

export interface BlockInterfaceProps {
    grid: Grid
    canvasStartX: number
    canvasStartY: number
    /**
     * Select a cell and scroll it into view, through the host's own selection
     * state. Used to walk between a block and its analysis — they are
     * deliberately not glued together, so getting from one to the other is
     * how the relationship stays workable. Omitted where a view has no
     * selection setter, and the navigation items simply don't appear.
     */
    navigateToCell?: (row: number, col: number) => void
}

/**
 * A block's number format per field name — what a pivot of it inherits, so a
 * SUM of a currency column reads as currency rather than as a bare number.
 */
function numFmtsOf(
    source: AnalysisSource | undefined
): Record<string, string | undefined> {
    return Object.fromEntries(
        (source?.fields ?? []).map((f) => [f.name, f.numFmt])
    )
}

/** Inclusive sheet-index rectangle. */
interface Region {
    sr: number
    sc: number
    er: number
    ec: number
}

/** The region a block occupies. */
function blockRegionOf(b: {
    info: {rowStart: number; colStart: number; rowCnt: number; colCnt: number}
}): Region {
    const {rowStart, colStart, rowCnt, colCnt} = b.info
    return {
        sr: rowStart,
        sc: colStart,
        er: rowStart + rowCnt - 1,
        ec: colStart + colCnt - 1,
    }
}

/**
 * Project a block into what {@link WorkbookOps.createAnalysisBlock} needs to
 * analyse it.
 *
 * `isNumber` comes from the field's DECLARATION, not from what its cells
 * happen to hold: guessing from the data totals an id column and leaves a
 * still-empty column out of a total it belongs in. That declaration is what
 * the field-semantics work put on the schema (see
 * `design/block-field-semantics.md`) — before it, no host could read a field
 * type back at all.
 */
function analysisSourceOf(info: BlockInfo): AnalysisSource | undefined {
    const schema = info.schema
    if (!schema) return undefined
    const numFmtOf = (renderId: string) =>
        info.fieldRenders.find((r) => r.renderId === renderId)?.style
            ?.formatter || undefined
    const fields = [...schema.fields]
        .sort((a, b) => a.idx - b.idx)
        .map((f) => ({
            name: f.field,
            isNumber: f.fieldType?.kind === 'number',
            numFmt: numFmtOf(f.renderId),
        }))
    return {
        sheetIdx: info.sheetIdx,
        blockId: info.blockId,
        refName: schema.name,
        rowStart: info.rowStart,
        rowCnt: info.rowCnt,
        colStart: info.colStart,
        fields,
        keyIdx: schema.keys[0]?.idx ?? 0,
    }
}

function regionsOverlap(a: Region, b: Region): boolean {
    return a.sr <= b.er && a.er >= b.sr && a.sc <= b.ec && a.ec >= b.sc
}

/**
 * Resolve the cell under a canvas-space point (origin = cell-area top-left,
 * i.e. `clientX - canvasStartX`). Only the visible window is searched, which
 * is all the drag interaction needs. Returns null when the point misses the
 * rendered grid.
 */
function cellAtCanvas(
    cx: number,
    cy: number,
    grid: Grid
): {row: number; col: number} | null {
    let col: number | null = null
    for (const c of grid.columns) {
        if (cx >= xForColStart(c.idx, grid) && cx < xForColEnd(c.idx, grid)) {
            col = c.idx
            break
        }
    }
    let row: number | null = null
    for (const r of grid.rows) {
        if (cy >= yForRowStart(r.idx, grid) && cy < yForRowEnd(r.idx, grid)) {
            row = r.idx
            break
        }
    }
    if (col === null || row === null) return null
    return {row, col}
}

export const BlockInterfaceComponent = (props: BlockInterfaceProps) => {
    const {grid, canvasStartX, canvasStartY, navigateToCell} = props
    const engine = useEngine()
    const BLOCK_MANAGER = engine.getBlockManager()
    // Which block the pointer is over. Lifted here because the highlight it
    // drives lands on a DIFFERENT block — a block and its analysis are
    // siblings in this list, so neither can light the other up on its own.
    const [hoveredBlock, setHoveredBlock] = useState<number | null>(null)
    // Which pivots have fallen behind their source, by block id.
    //
    // Asked for rather than derived, because a pivot's SHAPE is data: nothing
    // in the grid says a whole group is missing, and the numbers on screen
    // stay correct while it is. Costs one worker call per pivot per grid
    // update, and nothing at all in a workbook with no pivots.
    // Per pivot block: how many groups it is missing, or why its recipe
    // cannot be evaluated at all. The second is the worse of the two and used
    // to be discarded — a broken recipe makes every cell read 0 rather than
    // error, so with no badge the block looks like a table of real zeroes.
    const [pivotHealth, setPivotHealth] = useState<
        Map<number, {missing: number} | {broken: string}>
    >(new Map())
    const dataService = useDataService()
    useEffect(() => {
        const pivots = (grid.blockInfos ?? [])
            .map((b: BlockDisplayInfo) => b.info)
            .filter((i: BlockInfo) => i.pivot)
        if (pivots.length === 0) {
            setPivotHealth((prev) => (prev.size === 0 ? prev : new Map()))
            return
        }
        let cancelled = false
        void Promise.all(
            pivots.map(async (i: BlockInfo) => {
                const plan = await dataService
                    .getWorkbook()
                    .pivotPlan({sheetIdx: i.sheetIdx, blockId: i.blockId})
                if (isErrorMessage(plan))
                    return [i.blockId, {broken: plan.msg}] as const
                if (!plan.isStale) return null
                return [
                    i.blockId,
                    {
                        missing:
                            plan.missingKeys.length + plan.missingFields.length,
                    },
                ] as const
            })
        ).then((rows) => {
            if (cancelled) return
            const next = new Map<number, {missing: number} | {broken: string}>()
            for (const r of rows) if (r) next.set(r[0], r[1])
            // Replace only on a real change, or every grid update would
            // re-render every block for nothing.
            const same = (
                a: {missing: number} | {broken: string} | undefined,
                b: {missing: number} | {broken: string}
            ) => JSON.stringify(a) === JSON.stringify(b)
            setPivotHealth((prev) =>
                prev.size === next.size &&
                [...next].every(([k, v]) => same(prev.get(k), v))
                    ? prev
                    : next
            )
        })
        return () => {
            cancelled = true
        }
    }, [grid, dataService])

    if (!grid.blockInfos || grid.blockInfos.length === 0) {
        return null
    }

    const infos: BlockInfo[] = grid.blockInfos.map(
        (b: BlockDisplayInfo) => b.info
    )
    const nameOf = (blockId: number) =>
        infos.find((i: BlockInfo) => i.blockId === blockId)?.schema?.name
    /**
     * What a pivot needs to format a column a refresh adds: the number formats
     * of the block it analyses, plus its own recipe.
     *
     * The formats live on the SOURCE — a pivot cell aggregates a source column
     * — so this is only available from here, where every block's info is in
     * hand.
     */
    const pivotContextOf = (info: BlockInfo) => {
        if (!info.pivot || info.analyzes === undefined) return undefined
        const src = infos.find((i: BlockInfo) => i.blockId === info.analyzes)
        if (!src?.schema) return undefined
        return {
            source: {
                sheetIdx: src.sheetIdx,
                blockId: src.blockId,
                refName: src.schema.name,
                rowStart: src.rowStart,
                rowCnt: src.rowCnt,
                colStart: src.colStart,
                numFmts: numFmtsOf(analysisSourceOf(src)),
            },
            fields: src.schema.fields,
            keyIdx: src.schema.keys[0]?.idx,
            spec: info.pivot,
        }
    }
    /** A block's partners: what it analyses, and what analyses it. */
    const partnersOf = (blockId: number): number[] => {
        const info = infos.find((i: BlockInfo) => i.blockId === blockId)
        if (!info) return []
        return [
            ...(info.analyzes !== undefined ? [info.analyzes] : []),
            // Defaulted: a half-done wasm rebuild leaves the worker sending an
            // older BlockInfo, and the whole block layer throwing is a far
            // worse failure than no pair highlight.
            ...(info.analyzedBy ?? []),
        ]
    }
    // The pair affordance. Outlines are deliberately NOT merged (a pivot is
    // its own table and should never merge, and a merged outline un-merges
    // the moment the source moves or gains a column) — this is what replaces
    // it: point at either half and both are lit.
    const paired = new Set(
        hoveredBlock === null ? [] : partnersOf(hoveredBlock)
    )

    return (
        <>
            {grid.blockInfos.map((blockDisplay: BlockDisplayInfo) => {
                const {info} = blockDisplay
                const x = xForColStart(info.colStart, grid)
                const y = yForRowStart(info.rowStart, grid)
                const width =
                    xForColEnd(info.colStart + info.colCnt - 1, grid) - x
                const height =
                    yForRowEnd(info.rowStart + info.rowCnt - 1, grid) - y

                // Schema is set by the craft via `bindFormSchema`. On
                // file load the worker's schema bindings reset, and the
                // craft re-binds asynchronously — there's a window where
                // blockInfos exist but `info.schema` is undefined. Skip
                // rendering this block until the schema lands; the next
                // grid update will retry. Same applies to a field that
                // hasn't been restored into FieldManager yet (the appData
                // parse runs before the craft re-registers fields).
                if (!info.schema) return null

                // Built from the SCHEMA. Every schema field projects to a
                // FieldInfo, so there is no "a field did not resolve, skip the
                // whole block" case any more — which is what used to make a
                // foreign .xlsx render as nothing until a placeholder pass
                // papered over it.
                const safeFieldInfos = projectBlockFields(info)

                return (
                    <BlockInterface
                        key={`${info.sheetId}-${info.blockId}`}
                        x={x + LeftTop.width - 1}
                        y={y + LeftTop.height - 1}
                        width={width + 2}
                        height={height + 2}
                        sheetId={info.sheetId}
                        blockId={info.blockId}
                        sheetIdx={info.sheetIdx}
                        fieldInfo={safeFieldInfos}
                        rowCnt={info.rowCnt}
                        colCnt={info.colCnt}
                        colStart={info.colStart}
                        rowStart={info.rowStart}
                        blockManager={BLOCK_MANAGER}
                        canvasStartX={canvasStartX}
                        canvasStartY={canvasStartY}
                        cells={info.cells}
                        grid={grid}
                        title={info.schema.name}
                        schemaFields={info.schema.fields}
                        analysisSource={analysisSourceOf(info)}
                        pivotContext={pivotContextOf(info)}
                        analyzes={
                            info.analyzes === undefined
                                ? undefined
                                : {
                                      blockId: info.analyzes,
                                      name:
                                          nameOf(info.analyzes) ??
                                          `#${info.analyzes}`,
                                  }
                        }
                        analyzedBy={(info.analyzedBy ?? []).map(
                            (id: number) => ({
                                blockId: id,
                                name: nameOf(id) ?? `#${id}`,
                            })
                        )}
                        isPaired={paired.has(info.blockId)}
                        pivotSource={
                            info.pivot
                                ? undefined
                                : info.schema?.fields ?? undefined
                        }
                        pivotHealth={pivotHealth.get(info.blockId)}
                        isPivot={!!info.pivot}
                        pivotKeyIdx={info.schema?.keys?.[0]?.idx}
                        onHoverChange={(hovered) =>
                            setHoveredBlock((prev) =>
                                hovered
                                    ? info.blockId
                                    : prev === info.blockId
                                    ? null
                                    : prev
                            )
                        }
                        onGoToBlock={
                            navigateToCell &&
                            ((blockId: number) => {
                                const target = infos.find(
                                    (i: BlockInfo) => i.blockId === blockId
                                )
                                if (target)
                                    navigateToCell(
                                        target.rowStart,
                                        target.colStart
                                    )
                            })
                        }
                    />
                )
            })}
        </>
    )
}

interface BlockInterfaceInternalProps {
    x: number
    y: number
    width: number
    height: number
    sheetId: number
    blockId: number
    sheetIdx: number
    fieldInfo: FieldInfo[]
    rowCnt: number
    colCnt: number
    colStart: number
    rowStart: number
    blockManager: BlockManager
    canvasStartX: number
    canvasStartY: number
    cells: readonly BlockCellInfo[]
    grid: Grid
    title: string
    /**
     * The block's schema fields IN SCHEMA ORDER, not display order.
     * `UpsertFieldFormulas` takes one rule per field in exactly that order, so
     * the per-field rule dialog has to rebuild its vector from this list
     * rather than from the (idx-sorted) `fieldInfo` above.
     */
    schemaFields: readonly BlockSchemaFieldEntry[]
    /** This block, projected for `createAnalysisBlock`. */
    analysisSource?: AnalysisSource
    /**
     * Everything about this pivot that lives on its SOURCE rather than on it:
     * where the source is, what fields it has, and their number formats.
     *
     * A pivot's recipe names source fields, so both editing the recipe and
     * formatting a refreshed column need the source, not the pivot. Present
     * only on a pivot whose source is still there.
     */
    pivotContext?: {
        source: PivotSource
        fields: readonly BlockSchemaFieldEntry[]
        keyIdx?: number
        spec: PivotSpecParts
    }
    /** The block this one analyses, and the blocks that analyse it. */
    analyzes?: {blockId: number; name: string}
    analyzedBy: ReadonlyArray<{blockId: number; name: string}>
    /** True while the pointer is on this block's partner. */
    isPaired: boolean
    /**
     * This block's schema fields, when it is a candidate to be PIVOTED —
     * absent for a pivot itself, since pivoting a pivot is not the offer.
     */
    pivotSource?: readonly BlockSchemaFieldEntry[]
    /** True when this block IS a pivot. */
    isPivot: boolean
    /** Column index of the key field, so the dialog can avoid defaulting to it. */
    pivotKeyIdx?: number
    /**
     * What is wrong with this pivot, if anything. Absent when it is current.
     *
     * `missing` is how many groups the source has that it does not show — a
     * number, because "stale" alone does not tell a user whether it matters.
     * `broken` is worse: the recipe cannot be evaluated (normally it names a
     * source field that is gone), and the cells then read 0 rather than
     * erroring, so the block looks like a table of real zeroes.
     */
    pivotHealth?: {missing: number} | {broken: string}
    onHoverChange: (hovered: boolean) => void
    onGoToBlock?: (blockId: number) => void
}

const BlockInterface = observer((props: BlockInterfaceInternalProps) => {
    const {
        x,
        y,
        width,
        height,
        sheetId,
        blockId,
        sheetIdx,
        fieldInfo,
        rowCnt,
        colCnt,
        colStart,
        rowStart,
        title,
        blockManager,
        canvasStartX,
        canvasStartY,
        cells,
        grid,
        schemaFields,
        analysisSource,
        pivotContext,
        analyzes,
        analyzedBy,
        isPaired,
        pivotSource,
        isPivot,
        pivotKeyIdx,
        pivotHealth,
        onHoverChange,
        onGoToBlock,
    } = props

    const ops = useOps()
    const dataService = useDataService()
    const [isHover, setIsHover] = useState(false)
    // Drag-to-move state. `dragGhost` is the dashed rectangle shown at the
    // prospective drop position (coords relative to this block's Box);
    // `isDragging` hides the block's own cell widgets during the drag so the
    // move reads cleanly (only the block outline/ghost is shown).
    const [isDragging, setIsDragging] = useState(false)
    const [dragGhost, setDragGhost] = useState<{
        left: number
        top: number
        width: number
        height: number
        invalid: boolean
    } | null>(null)
    // Allow a global setting to override hover and keep overlays visible.
    const showInfo = globalStore.alwaysShowBlockInfo || isHover
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    // Block composer opened in edit mode by the gear menu's "Modify". Owned here
    // (not in MenuComponent) so it survives the menu unmounting on select.
    const [editComposerOpen, setEditComposerOpen] = useState(false)
    // Field-header sort menu: which field name was clicked and the element to
    // anchor the asc/desc menu to.
    const [sortMenu, setSortMenu] = useState<{
        anchor: HTMLElement
        field: string
    } | null>(null)

    // Deleting a block that has analyses deletes those too (the engine
    // cascades), so the user is told which blocks before it happens rather
    // than after.
    const [deleteConfirm, setDeleteConfirm] = useState(false)

    const handleDelete = async () => {
        setDeleteConfirm(false)
        try {
            await ops.removeBlock(sheetIdx, blockId)
        } catch (e) {
            toast.error(
                `Failed to delete block: ${
                    e instanceof Error ? e.message : String(e)
                }`
            )
        }
    }

    /**
     * Create the block that analyses this one — a totals row below it.
     *
     * Every aggregate is a DECLARATION; the engine generates the formulas, so
     * renaming a field of this block rebuilds the total rather than silently
     * zeroing it. See `design/block-analysis.md`.
     */
    const handleCreateAnalysis = async () => {
        if (!analysisSource) return
        const refName = `${analysisSource.refName}_analysis`
        try {
            const newId = await dataService.getAvailableBlockId(sheetIdx)
            if (isErrorMessage(newId)) {
                toast.error(newId.msg)
                return
            }
            const aggregated = await ops.createAnalysisBlock({
                source: analysisSource,
                blockId: newId,
                refName,
                label: 'Total',
            })
            toast.success(
                `Created analysis block "${refName}": ` +
                    aggregated.map((a) => `${a.func}(${a.field})`).join(', ') +
                    `. Reference a result with BLOCKREF("${refName}", "Total", "<field>").`
            )
        } catch (e) {
            toast.error(
                `Could not create the analysis block: ${
                    e instanceof Error ? e.message : String(e)
                }`
            )
        }
    }

    // Pivot creation asks three questions that have no safe default, so it
    // opens a dialog rather than acting on a menu click.
    const [pivotDialog, setPivotDialog] = useState(false)
    // Editing reuses the same dialog, prefilled. `undefined` means creating.
    const [pivotEdit, setPivotEdit] = useState<PivotSpecChoice | undefined>()

    const handleCreatePivot = async (spec: PivotSpecChoice) => {
        setPivotDialog(false)
        try {
            const newId = await dataService.getAvailableBlockId(sheetIdx)
            if (isErrorMessage(newId)) {
                toast.error(newId.msg)
                return
            }
            const made = await ops.createPivot({
                source: {
                    sheetIdx,
                    blockId,
                    refName: title,
                    rowStart,
                    rowCnt,
                    colStart,
                    // So a pivot of a currency column reads as currency.
                    numFmts: numFmtsOf(analysisSource),
                },
                blockId: newId,
                ...spec,
            })
            toast.success(
                `Created pivot “${spec.refName}”: ` +
                    `${made.keys.length} rows × ${made.fields.length} columns. ` +
                    `Reference a cell with BLOCKREF("${spec.refName}", "<${spec.rowDim}>", "<column>"). ` +
                    // Both of these say the pivot is showing LESS than the
                    // source holds, which nothing on the sheet reveals.
                    (spec.filters?.length
                        ? `Only records matching ${spec.filters
                              .map((f) => `${f.field} ${f.criteria}`)
                              .join(', ')} were counted. `
                        : '') +
                    (made.unassignedRecords > 0
                        ? `Note: ${made.unassignedRecords} record(s) have an empty ${spec.rowDim} and are in no cell.`
                        : '')
            )
        } catch (e) {
            toast.error(
                `Could not create the pivot: ${
                    e instanceof Error ? e.message : String(e)
                }`
            )
        }
    }

    /**
     * Re-open the dialog over this pivot's own recipe.
     *
     * The declared columns come back apart into the two things they read as: a
     * column with no measure of its own is the row total, one with a measure
     * is a second number.
     */
    const openPivotEdit = () => {
        if (!pivotContext) return
        const spec = pivotContext.spec
        setPivotEdit({
            refName: title,
            rowDim: spec.rowDim,
            colDim: spec.colDim,
            measure: spec.measure,
            func: spec.func as AggFunc,
            order: spec.order as DimOrder | undefined,
            orderValues: spec.orderValues ? [...spec.orderValues] : undefined,
            filters: spec.filters ? [...spec.filters] : undefined,
            extraColumns: schemaFields
                .filter((f) => f.pivotColValue !== undefined)
                .map((f) => ({
                    name: f.field,
                    colValue:
                        f.pivotColValue === '*'
                            ? null
                            : f.pivotColValue ?? null,
                    func: f.pivotFunc as AggFunc | undefined,
                    measure: f.pivotMeasure,
                })),
        })
    }

    const handleEditPivot = async (spec: PivotSpecChoice) => {
        setPivotEdit(undefined)
        if (!pivotContext) return
        try {
            const made = await ops.editPivot({
                sheetIdx,
                blockId,
                source: pivotContext.source,
                rowStart,
                colStart,
                currentRowCnt: rowCnt,
                currentColCnt: colCnt,
                ...spec,
                // The block keeps its name: an edit that renamed it would
                // break every formula pointing at it, which is the whole
                // reason to edit instead of rebuilding.
                refName: title,
            })
            toast.success(
                `Re-cut “${title}”: rows = ${spec.rowDim}` +
                    (spec.colDim ? `, columns = ${spec.colDim}` : '') +
                    `, ${spec.func} of ${spec.measure}. ` +
                    `Now ${made.keys.length} rows × ${made.fields.length} columns.` +
                    (made.unassignedRecords > 0
                        ? ` ${made.unassignedRecords} record(s) have an empty ${spec.rowDim} and are in no cell.`
                        : '')
            )
        } catch (e) {
            toast.error(
                `Could not change the recipe: ${
                    e instanceof Error ? e.message : String(e)
                }`
            )
        }
    }

    const handleRefreshPivot = async () => {
        try {
            const changed = await ops.refreshPivot({
                sheetIdx,
                blockId,
                refName: title,
                // The key column holds the row dimension; its FIELD name is
                // what the re-bind has to restate.
                keyField: schemaFields[0]?.field ?? '',
                rowStart,
                colStart,
                // So a row total or a second measure is restated rather than
                // rewritten as an ordinary derived column.
                currentFields: schemaFields,
                // So a column the refresh ADDS is formatted like the ones
                // beside it instead of arriving as a bare number.
                formats: pivotContext
                    ? {
                          numFmts: pivotContext.source.numFmts ?? {},
                          measure: pivotContext.spec.measure,
                          func: pivotContext.spec.func as AggFunc,
                      }
                    : undefined,
            })
            if (!changed) {
                toast.info(`“${title}” is already up to date.`)
                return
            }
            const bits: string[] = []
            if (changed.addedKeys.length)
                bits.push(`added rows ${changed.addedKeys.join(', ')}`)
            if (changed.removedKeys.length)
                bits.push(`removed rows ${changed.removedKeys.join(', ')}`)
            if (changed.addedFields.length)
                bits.push(`added columns ${changed.addedFields.join(', ')}`)
            if (changed.removedFields.length)
                bits.push(`removed columns ${changed.removedFields.join(', ')}`)
            toast.success(
                `Refreshed “${title}”: ${bits.join('; ')}. ` +
                    (changed.unassignedRecords > 0
                        ? `${changed.unassignedRecords} record(s) still have an empty group value and are in no cell — a refresh cannot fix that, the data has to.`
                        : '')
            )
        } catch (e) {
            toast.error(
                `Refresh failed: ${e instanceof Error ? e.message : String(e)}`
            )
        }
    }

    const handleSortField = async (field: string, asc: boolean) => {
        setSortMenu(null)
        try {
            await ops.sortBlock(sheetIdx, blockId, field, asc)
        } catch (e) {
            toast.error(
                `Failed to sort by "${field}": ${
                    e instanceof Error ? e.message : String(e)
                }`
            )
        }
    }

    // Which per-field rule the header menu opened, if any.
    const [ruleDialog, setRuleDialog] = useState<{
        kind: FieldRuleKind
        field: string
    } | null>(null)

    const ruleOf = (field: string, kind: FieldRuleKind): string => {
        const entry = schemaFields.find((f) => f.field === field)
        const raw =
            kind === 'value' ? entry?.valueFormula : entry?.validationFormula
        return raw ?? ''
    }

    const handleSaveRule = async (
        kind: FieldRuleKind,
        field: string,
        rule: string
    ) => {
        setRuleDialog(null)
        // One entry per field, in the schema's own order — the engine replaces
        // the whole vector for this rule kind, so every field that is not the
        // one being edited has to carry its rule through unchanged.
        const formulas = schemaFields.map((f) =>
            f.field === field ? rule : ruleOf(f.field, kind)
        )
        try {
            await ops.setFieldRules({sheetIdx, blockId, kind, formulas})
        } catch (e) {
            toast.error(
                `Failed to set the ${
                    kind === 'value' ? 'field formula' : 'validation rule'
                } on "${field}": ${e instanceof Error ? e.message : String(e)}`
            )
        }
    }
    const [clickMousePosition, setClickMousePosition] = useState({x: 0, y: 0})
    const [descriptorUrl, setDescriptorUrl] = useState<string | undefined>()
    const [error, setError] = useState<string | undefined>()
    const [successMessage, setSuccessMessage] = useState<string | undefined>()
    // const [blockCellProps, setBlockCellProps] = useState<BlockCellProps[]>([])

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            const mx = e.clientX - canvasStartX + LeftTop.width
            const my = e.clientY - canvasStartY + LeftTop.height

            // expandedTop covers the title bar (28px) + field headers (32px)
            // + a little breathing room so the mouse can move up into them
            // without losing hover. Without hover the hit-area hugs the
            // border closely.
            const expandedTop = isHover ? -80 : -6
            const expandedBottom = isHover ? 30 : 6
            const expandedRight = isHover ? 30 : 6

            const left = x - 6
            const top = y + expandedTop
            const right = x + width + expandedRight
            const bottom = y + height + expandedBottom
            const inside =
                mx >= left && mx <= right && my >= top && my <= bottom
            setIsHover(inside)
        }
        window.addEventListener('mousemove', onMove)
        return () => {
            window.removeEventListener('mousemove', onMove)
        }
    }, [x, y, width, height, canvasStartX, canvasStartY, isHover])

    // Report hover to the parent, which is the only place that can light up
    // this block's PARTNER — a block and its analysis are siblings in the same
    // list, so neither can reach the other.
    //
    // Through a ref, and keyed on `isHover` alone: the parent hands down a
    // fresh callback on every render, and calling it from an effect that
    // re-ran on identity would set parent state, re-render, and call it again.
    const hoverCbRef = useRef(onHoverChange)
    hoverCbRef.current = onHoverChange
    useEffect(() => {
        hoverCbRef.current(isHover)
        return () => hoverCbRef.current(false)
    }, [isHover])

    const baseX = xForColStart(colStart, grid)
    const baseY = yForRowStart(rowStart, grid)

    // One BlockCellInfo can yield several rendered cells: at most one
    // interactive widget plus zero-or-more display overlays (validation,
    // required, ...). buildRenderedCells encodes that mapping.
    //
    // grid.rows / grid.columns hold only the *visible* window — they're
    // indexed positionally, but each entry's `.idx` is its absolute sheet
    // row/column. We must look up by `.idx`, not treat the absolute idx
    // as an array offset, or scrolling explodes with "undefined.height".
    // Cells outside the visible window are simply skipped here; they'll
    // re-render when scrolled back into view.
    const renderedCells: RenderedCellSpec[] = cells.flatMap((cell, idx) => {
        const rowIdx = Math.floor(idx / fieldInfo.length)
        const colIdx = idx % fieldInfo.length
        const absRow = rowStart + rowIdx
        const absCol = colStart + colIdx
        const colInfo = grid.columns.find(
            (c: {idx: number; width: number}) => c.idx === absCol
        )
        const rowInfo = grid.rows.find(
            (r: {idx: number; height: number}) => r.idx === absRow
        )
        if (!colInfo || !rowInfo) return []
        const x = xForColStart(absCol, grid) - baseX
        const y = yForRowStart(absRow, grid) - baseY
        const width = colInfo.width
        const height = rowInfo.height
        const f = fieldInfo[colIdx]
        const base: BlockCellProps = {
            x,
            y,
            width,
            height,
            value: cell.value,
            shadowValue: cell.shadowValue,
            fieldInfo: f,
            rowIdx: absRow,
            colIdx: absCol,
            sheetIdx,
        }
        return buildRenderedCells(base)
    })

    const handleMenuClick = (event: React.MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        setClickMousePosition({
            x: event.clientX,
            y: event.clientY,
        })
        setIsMenuOpen(true)
    }

    const handleAddRow = async (event: React.MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()

        await ops.insertRowsInBlock(sheetIdx, blockId, rowCnt, 1)
    }

    const origRegion: Region = {
        sr: rowStart,
        sc: colStart,
        er: rowStart + rowCnt - 1,
        ec: colStart + colCnt - 1,
    }

    // Synchronous half of the drop check: does the target region overlap any
    // OTHER block? Overlapping another block is refused even if that block's
    // cells happen to be empty — two blocks must never share cells.
    const targetHitsOtherBlock = (target: Region): boolean =>
        (grid.blockInfos ?? []).some(
            (b: BlockDisplayInfo) =>
                b.info.blockId !== blockId &&
                regionsOverlap(target, blockRegionOf(b))
        )

    // Drop check: is the target region occupied? It counts as occupied when it
    // overlaps another block, or covers a non-empty cell (value / string not
    // empty). Cells inside the block's own footprint are skipped (it vacates
    // them on move).
    const targetCovered = async (master: {
        row: number
        col: number
    }): Promise<boolean> => {
        if (!dataService) return true
        const target: Region = {
            sr: master.row,
            sc: master.col,
            er: master.row + rowCnt - 1,
            ec: master.col + colCnt - 1,
        }
        // Block overlap is decidable without reading cells — check it first.
        if (targetHitsOtherBlock(target)) return true
        const checks: Promise<boolean>[] = []
        for (let r = target.sr; r <= target.er; r++) {
            for (let c = target.sc; c <= target.ec; c++) {
                const inSelf =
                    r >= origRegion.sr &&
                    r <= origRegion.er &&
                    c >= origRegion.sc &&
                    c <= origRegion.ec
                if (inSelf) continue
                checks.push(
                    dataService.getCellInfo(sheetIdx, r, c).then((cell) => {
                        if (isErrorMessage(cell)) return false
                        // Non-empty value / non-empty string ⇒ covered.
                        return cell.getText() !== ''
                    })
                )
            }
        }
        const results = await Promise.all(checks)
        return results.some(Boolean)
    }

    // Grab the block by its border and drag it to a new master cell. Promotes
    // to an actual move only once the pointer travels past DRAG_THRESHOLD, so a
    // plain click on the border still falls through to normal cell selection.
    // Movement is measured as a cell delta from the grabbed cell, so the block
    // tracks the cursor from wherever on the border it was picked up.
    const handleDragStart = (e: React.MouseEvent) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()

        const DRAG_THRESHOLD = 3 // px before a press becomes a drag
        const startX = e.clientX
        const startY = e.clientY
        const originX = xForColStart(colStart, grid)
        const originY = yForRowStart(rowStart, grid)
        // Cell under the grab point; delta is measured from here. Captured
        // lazily if the grab lands just off the grid (e.g. the border strip
        // that overhangs the header row).
        let refCell = cellAtCanvas(
            e.clientX - canvasStartX,
            e.clientY - canvasStartY,
            grid
        )
        let dragging = false
        let latestMaster: {row: number; col: number} | null = null
        // Live "would-cover" feedback. The check is async (reads cells), so we
        // only re-run it when the target master cell changes, and guard each
        // run with a token so a slow reply can't overwrite a newer position.
        let lastKey = ''
        let checkToken = 0

        const onMove = (me: MouseEvent) => {
            if (!dragging) {
                if (
                    Math.abs(me.clientX - startX) < DRAG_THRESHOLD &&
                    Math.abs(me.clientY - startY) < DRAG_THRESHOLD
                )
                    return
                dragging = true
                setIsDragging(true)
            }
            const cell = cellAtCanvas(
                me.clientX - canvasStartX,
                me.clientY - canvasStartY,
                grid
            )
            if (!cell) return
            if (!refCell) refCell = cell
            const master = {
                row: Math.max(0, rowStart + cell.row - refCell.row),
                col: Math.max(0, colStart + cell.col - refCell.col),
            }
            latestMaster = master
            // Block overlap is decidable synchronously → show red instantly.
            // The async cell-content re-check below can only promote it to red
            // (never clears a real overlap), so start from this value.
            const target: Region = {
                sr: master.row,
                sc: master.col,
                er: master.row + rowCnt - 1,
                ec: master.col + colCnt - 1,
            }
            const overlapInvalid = targetHitsOtherBlock(target)
            setDragGhost((prev) => ({
                left: xForColStart(master.col, grid) - originX,
                top: yForRowStart(master.row, grid) - originY,
                width,
                height,
                // Keep the previous (possibly async-derived) invalid unless the
                // sync overlap check already says red — avoids a red→purple
                // flicker between frames while the async check is in flight.
                invalid: overlapInvalid || (prev?.invalid ?? false),
            }))
            const key = `${master.row},${master.col}`
            if (key !== lastKey) {
                lastKey = key
                const token = ++checkToken
                targetCovered(master).then((covered) => {
                    if (token !== checkToken || !dragging) return
                    setDragGhost((prev) =>
                        prev ? {...prev, invalid: covered} : prev
                    )
                })
            }
        }

        const onUp = async () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
            checkToken++ // invalidate any in-flight live check
            setIsDragging(false)
            setDragGhost(null)
            const master = latestMaster
            // A press without a real drag, or a no-op move — do nothing.
            if (!dragging || !master) return
            if (master.row === rowStart && master.col === colStart) return
            // Overlapping another block or covering a non-empty cell is not
            // allowed: warn the user and cancel rather than clobbering data.
            if (await targetCovered(master)) {
                toast.warn('Cannot move block: the target area is occupied')
                return
            }
            await ops.moveBlock(sheetIdx, blockId, master.row, master.col)
        }

        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }

    // Field-header drag-to-reorder. Grab a field header and drop it at another
    // field position → one `moveBlockLine` (isRow:false) transaction. Only
    // promotes to a drag past DRAG_THRESHOLD, so a plain click still opens the
    // sort menu; `fieldDragMovedRef` suppresses the click that follows a drag.
    // `fieldDrag.ins` is the drop boundary (0..colCnt) shown as an insertion
    // line between field headers.
    const [fieldDrag, setFieldDrag] = useState<{
        from: number
        ins: number
    } | null>(null)
    const fieldDragMovedRef = useRef(false)

    const handleFieldDragStart = (fromIdx: number) => (e: React.MouseEvent) => {
        if (e.button !== 0) return
        e.stopPropagation()
        // Prevent the browser from starting a text selection on the field
        // name while dragging.
        e.preventDefault()
        fieldDragMovedRef.current = false
        const DRAG_THRESHOLD = 3
        const startX = e.clientX
        const startY = e.clientY
        let dragging = false
        let ins: number | null = null

        // Map the pointer to a drop boundary in [0, colCnt]: the hovered
        // block column's left half inserts before it, right half after.
        // Pointer outside the block's own column span clamps to an edge.
        const computeIns = (me: MouseEvent): number => {
            const cx = me.clientX - canvasStartX
            const cell = cellAtCanvas(cx, me.clientY - canvasStartY, grid)
            if (!cell || cell.col < colStart) return 0
            if (cell.col >= colStart + colCnt) return colCnt
            const inner = cell.col - colStart
            const colInfo = grid.columns.find(
                (c: {idx: number; width: number}) => c.idx === cell.col
            )
            const mid = xForColStart(cell.col, grid) + (colInfo?.width ?? 0) / 2
            return cx < mid ? inner : inner + 1
        }

        const onMove = (me: MouseEvent) => {
            if (!dragging) {
                if (
                    Math.abs(me.clientX - startX) < DRAG_THRESHOLD &&
                    Math.abs(me.clientY - startY) < DRAG_THRESHOLD
                )
                    return
                dragging = true
                fieldDragMovedRef.current = true
            }
            ins = computeIns(me)
            setFieldDrag({from: fromIdx, ins})
        }

        const onUp = async () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
            setFieldDrag(null)
            if (!dragging || ins === null) return
            // `move_line` is remove(from) then insert(to), so `to` is the
            // index in the post-removal frame: a boundary to the right of
            // the removed field shifts left by one.
            const to = ins > fromIdx ? ins - 1 : ins
            if (to === fromIdx) return
            try {
                await ops.moveBlockLine(sheetIdx, blockId, fromIdx, to, false)
            } catch (err) {
                toast.error(
                    `Failed to move field: ${
                        err instanceof Error ? err.message : String(err)
                    }`
                )
            }
        }

        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }

    return (
        <Box
            data-testid="block-interface"
            data-block-id={blockId}
            data-row-start={rowStart}
            data-col-start={colStart}
            sx={{
                position: 'absolute',
                width: `${width}px`,
                height: `${height}px`,
                left: `${x}px`,
                top: `${y}px`,
                pointerEvents: 'none',
                zIndex: ZINDEX_BLOCK_OUTLINER,
            }}
        >
            {/* Border and hover area */}
            <Box
                sx={{
                    position: 'absolute',
                    inset: '-6px',
                    pointerEvents: 'none',
                    borderRadius: 1,
                }}
            >
                {/* Main border. `isPaired` — the pointer is on this block's
                    source or on one of its analyses — draws it in the same
                    strong colour as hover, so pointing at either half of a
                    pair shows both. This is what replaces merging the two
                    outlines: it works when they are not adjacent, when their
                    column counts differ, and for a pivot, none of which a
                    merged outline survives. */}
                <Box
                    sx={{
                        position: 'absolute',
                        inset: '6px',
                        border: '2px solid',
                        borderColor:
                            showInfo || isPaired
                                ? 'rgb(103, 58, 183)'
                                : 'rgba(103, 58, 183, 0.5)',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s',
                        pointerEvents: 'none',
                        borderRadius: '4px',
                        // A dashed outline on the partner, so which one the
                        // pointer is actually on stays unambiguous.
                        ...(isPaired && !showInfo
                            ? {borderStyle: 'dashed'}
                            : {}),
                    }}
                />

                {/* Draggable border: four thin hit regions hugging the outline.
                    Grabbing an edge and dragging moves the whole block; the
                    interior stays clear so its cells remain clickable. Always
                    active (not hover-gated) so the border is grabbable anytime;
                    the 'move' cursor advertises it. */}
                {(
                    [
                        {top: 0, left: 0, right: 0, height: 10},
                        {bottom: 0, left: 0, right: 0, height: 10},
                        {top: 0, bottom: 0, left: 0, width: 10},
                        {top: 0, bottom: 0, right: 0, width: 10},
                    ] as const
                ).map((pos, i) => (
                    <Box
                        key={`drag-edge-${i}`}
                        onMouseDown={handleDragStart}
                        sx={{
                            position: 'absolute',
                            ...pos,
                            cursor: isDragging ? 'grabbing' : 'move',
                            pointerEvents: 'auto',
                        }}
                    />
                ))}

                {/* Settings button (top right) — hover only, even when the
                    "always show block info" toggle is on. The toggle only
                    keeps the title and field name headers visible.

                    BOTTOM right on an analysis block, because it is placed
                    directly beneath the block it analyses, and the source's
                    draggable bottom edge (a 10px band, always live so the
                    outline is grabbable anytime) sits exactly where a top-
                    right button would be — swallowing every click on it. Hung
                    below instead, it is reachable, and it reads correctly too:
                    an analysis block's controls hang off its lower edge, away
                    from the table above. */}
                {isHover && (
                    <Box
                        sx={{
                            position: 'absolute',
                            ...(analyzes ? {bottom: '-12px'} : {top: '-12px'}),
                            right: '-12px',
                            width: 22,
                            height: 22,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'white',
                            borderRadius: '50%',
                            boxShadow: 3,
                            border: '2px solid rgb(103, 58, 183)',
                            color: 'rgb(103, 58, 183)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': {
                                background: 'rgb(103, 58, 183)',
                                color: '#fff',
                                transform: 'scale(1.1)',
                            },
                            pointerEvents: 'auto',
                        }}
                        onClick={handleMenuClick}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <SettingsIcon sx={{fontSize: 20}} />
                    </Box>
                )}

                {/* Drop-target ghost shown while dragging. */}
                {dragGhost && (
                    <Box
                        sx={{
                            position: 'absolute',
                            left: `${dragGhost.left + 6}px`,
                            top: `${dragGhost.top + 6}px`,
                            width: `${dragGhost.width}px`,
                            height: `${dragGhost.height}px`,
                            boxSizing: 'border-box',
                            border: '2px dashed',
                            borderColor: dragGhost.invalid
                                ? 'rgb(211, 47, 47)'
                                : 'rgb(103, 58, 183)',
                            background: dragGhost.invalid
                                ? 'rgba(211, 47, 47, 0.10)'
                                : 'rgba(103, 58, 183, 0.10)',
                            borderRadius: '4px',
                            pointerEvents: 'none',
                        }}
                    />
                )}

                {/* Title bar (top, above field headers). Clip-path hides
                    the slice that would extend above the spreadsheet's
                    column-header row so the schema info never visually
                    covers it (see field headers overlay below for the
                    same trick). */}
                {(showInfo || isPaired) && title && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: '-72px',
                            left: '6px',
                            right: '6px',
                            height: '24px',
                            clipPath: `inset(${Math.max(
                                0,
                                LeftTop.height - (y - 72)
                            )}px 0 0 ${Math.max(
                                0,
                                LeftTop.width - (x + 6)
                            )}px)`,
                            background:
                                'linear-gradient(135deg, rgb(69, 39, 160) 0%, rgb(49, 27, 146) 100%)',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            px: 1,
                            boxShadow: 2,
                            pointerEvents: 'auto',
                            boxSizing: 'border-box',
                        }}
                    >
                        <Typography
                            variant="caption"
                            sx={{
                                color: 'white',
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                letterSpacing: '0.02em',
                                textAlign: 'center',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                width: '100%',
                            }}
                        >
                            {title}
                            {/* Names its source, so an analysis block is
                                self-explanatory seen alone — the pair is not
                                glued together and may be nowhere near it. */}
                            {analyzes && ` ← Σ ${analyzes.name}`}
                        </Typography>
                    </Box>
                )}

                {/* A stale pivot is the one thing on this sheet that looks
                    right and is not: every number in it is correct, and whole
                    groups are missing. So it says so on the block, without
                    waiting for anyone to open a menu. */}
                {pivotHealth && (
                    <Tooltip
                        title={
                            'broken' in pivotHealth
                                ? `This pivot's recipe no longer resolves: ${pivotHealth.broken}. Every cell therefore reads 0 instead of erroring — do not use these numbers. Fix the recipe or rebuild it.`
                                : `The source has ${pivotHealth.missing} group(s) that are not shown here. Every number in the table is right, but the table is incomplete — click to refresh.`
                        }
                        arrow
                    >
                        <Box
                            sx={{
                                position: 'absolute',
                                top: '-12px',
                                left: '6px',
                                height: 20,
                                px: 0.75,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                background: 'rgb(211, 47, 47)',
                                color: '#fff',
                                borderRadius: '10px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                boxShadow: 2,
                                whiteSpace: 'nowrap',
                                pointerEvents: 'auto',
                                cursor:
                                    'broken' in pivotHealth
                                        ? 'help'
                                        : 'pointer',
                            }}
                            onClick={(e) => {
                                e.stopPropagation()
                                // A refresh cannot fix a broken recipe — it
                                // fails the same way — so the badge only
                                // offers it when it would help.
                                if (!('broken' in pivotHealth))
                                    void handleRefreshPivot()
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            {'broken' in pivotHealth ? (
                                <>
                                    <ErrorOutlineIcon sx={{fontSize: 13}} />
                                    Recipe broken
                                </>
                            ) : (
                                <>
                                    <RefreshIcon sx={{fontSize: 13}} />
                                    {pivotHealth.missing} group
                                    {pivotHealth.missing === 1 ? '' : 's'}{' '}
                                    missing
                                </>
                            )}
                        </Box>
                    </Tooltip>
                )}

                {/* Field headers (top) */}
                {showInfo && fieldInfo.length > 0 && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: '-40px',
                            left: '6px',
                            right: '6px',
                            height: '32px',
                            clipPath: `inset(${Math.max(
                                0,
                                LeftTop.height - (y - 40)
                            )}px 0 0 ${Math.max(
                                0,
                                LeftTop.width - (x + 6)
                            )}px)`,
                            display: 'flex',
                            gap: '1px',
                            pointerEvents: 'none',
                        }}
                    >
                        {fieldInfo.map((f, idx) => {
                            const fieldName = f.name || 'Unnamed'

                            // Look up by absolute column idx — grid.columns
                            // only carries the visible window, so a column
                            // scrolled off-screen returns undefined here.
                            const absCol = idx + colStart
                            const colInfo = grid.columns.find(
                                (c: {idx: number; width: number}) =>
                                    c.idx === absCol
                            )
                            if (!colInfo) return null
                            const width = colInfo.width

                            return (
                                <Tooltip
                                    key={idx}
                                    title={`${
                                        f.description || fieldName
                                    } — click to sort, drag to reorder`}
                                    arrow
                                >
                                    <Box
                                        onMouseDown={handleFieldDragStart(idx)}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            // Suppress the click that follows a
                                            // drag; a plain click still sorts.
                                            if (fieldDragMovedRef.current) {
                                                fieldDragMovedRef.current =
                                                    false
                                                return
                                            }
                                            setSortMenu({
                                                anchor: e.currentTarget,
                                                field: fieldName,
                                            })
                                        }}
                                        sx={{
                                            width: `${width}px`,
                                            height: '100%',
                                            background:
                                                'linear-gradient(135deg, rgb(103, 58, 183) 0%, rgb(81, 45, 168) 100%)',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            px: 1,
                                            boxShadow: 2,
                                            pointerEvents: 'auto',
                                            boxSizing: 'border-box',
                                            userSelect: 'none',
                                            cursor:
                                                fieldDrag?.from === idx
                                                    ? 'grabbing'
                                                    : 'grab',
                                            opacity:
                                                fieldDrag?.from === idx
                                                    ? 0.4
                                                    : 1,
                                            '&:hover': {
                                                filter: 'brightness(1.1)',
                                            },
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: 'white',
                                                fontWeight: 600,
                                                fontSize: '0.75rem',
                                                textAlign: 'center',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                width: '100%',
                                            }}
                                        >
                                            {fieldName}
                                        </Typography>
                                    </Box>
                                </Tooltip>
                            )
                        })}
                        {/* Insertion line at the drop boundary while a field
                            header is being dragged. */}
                        {fieldDrag &&
                            (() => {
                                let left = 0
                                for (let j = 0; j < fieldDrag.ins; j++) {
                                    const ci = grid.columns.find(
                                        (c: {idx: number; width: number}) =>
                                            c.idx === colStart + j
                                    )
                                    left += (ci?.width ?? 0) + 1
                                }
                                return (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            left: `${Math.max(0, left - 1)}px`,
                                            top: 0,
                                            width: '3px',
                                            height: '100%',
                                            borderRadius: '2px',
                                            background: 'rgb(255, 193, 7)',
                                            boxShadow: 1,
                                            pointerEvents: 'none',
                                            zIndex: 1,
                                        }}
                                    />
                                )
                            })()}
                    </Box>
                )}

                {/* Field sort menu (opened by clicking a field-name header). */}
                <ContextMenu
                    open={sortMenu !== null}
                    anchorEl={sortMenu?.anchor ?? null}
                    onClose={() => setSortMenu(null)}
                    anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
                    transformOrigin={{vertical: 'top', horizontal: 'center'}}
                >
                    <ContextMenuItem
                        icon={<ArrowUpwardIcon />}
                        onClick={() =>
                            sortMenu && handleSortField(sortMenu.field, true)
                        }
                    >
                        Sort ascending
                    </ContextMenuItem>
                    <ContextMenuItem
                        icon={<ArrowDownwardIcon />}
                        onClick={() =>
                            sortMenu && handleSortField(sortMenu.field, false)
                        }
                    >
                        Sort descending
                    </ContextMenuItem>
                    {/* The two rules a field can carry. Labelled by whether one
                        is already in force, so the menu says what the column
                        does without having to open anything. */}
                    <ContextMenuItem
                        icon={<FunctionsIcon />}
                        onClick={() => {
                            if (!sortMenu) return
                            setRuleDialog({
                                kind: 'value',
                                field: sortMenu.field,
                            })
                            setSortMenu(null)
                        }}
                    >
                        {sortMenu && ruleOf(sortMenu.field, 'value') !== ''
                            ? 'Edit field formula…'
                            : 'Set field formula…'}
                    </ContextMenuItem>
                    <ContextMenuItem
                        icon={<RuleIcon />}
                        onClick={() => {
                            if (!sortMenu) return
                            setRuleDialog({
                                kind: 'validation',
                                field: sortMenu.field,
                            })
                            setSortMenu(null)
                        }}
                    >
                        {sortMenu && ruleOf(sortMenu.field, 'validation') !== ''
                            ? 'Edit validation rule…'
                            : 'Set validation rule…'}
                    </ContextMenuItem>
                </ContextMenu>

                {ruleDialog && (
                    <FieldRuleDialog
                        kind={ruleDialog.kind}
                        fieldName={ruleDialog.field}
                        allFieldNames={schemaFields.map((f) => f.field)}
                        initialValue={ruleOf(ruleDialog.field, ruleDialog.kind)}
                        onSave={(rule) =>
                            handleSaveRule(
                                ruleDialog.kind,
                                ruleDialog.field,
                                rule
                            )
                        }
                        onClose={() => setRuleDialog(null)}
                    />
                )}

                {/* Add row button (bottom) — hover only, like the settings
                    button. */}
                {isHover && (
                    <Box
                        sx={{
                            position: 'absolute',
                            bottom: '-18px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            pointerEvents: 'auto',
                        }}
                    >
                        <Tooltip title="Add new row" arrow>
                            <IconButton
                                onClick={handleAddRow}
                                onMouseDown={(e) => e.stopPropagation()}
                                sx={{
                                    width: 16,
                                    height: 16,
                                    background:
                                        'linear-gradient(135deg, rgb(103, 58, 183) 0%, rgb(81, 45, 168) 100%)',
                                    color: 'white',
                                    boxShadow: 3,
                                    '&:hover': {
                                        background:
                                            'linear-gradient(135deg, rgb(81, 45, 168) 0%, rgb(69, 39, 160) 100%)',
                                        transform: 'scale(1.1)',
                                        boxShadow: 4,
                                    },
                                    transition: 'all 0.2s',
                                }}
                            >
                                <AddIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
            </Box>

            {/* Block cells: interactive widgets and display overlays are
                dispatched separately on the `kind` discriminator so the two
                categories never collide. Hidden while dragging so only the
                block outline + drop ghost are shown. */}
            {!isDragging &&
                renderedCells.map((spec, idx) => {
                    if (spec.kind === 'interactive') {
                        switch (spec.interactiveKind) {
                            case 'enum':
                                return <EnumCell key={idx} {...spec} />
                            case 'boolean':
                                return <BoolCell key={idx} {...spec} />
                            case 'datetime':
                                return <DatetimeCell key={idx} {...spec} />
                            case 'image':
                                return <ImageCell key={idx} {...spec} />
                            case 'fieldRef':
                                return <FieldRefCell key={idx} {...spec} />
                            case 'multiSelectRef':
                                return <MultiFieldRefCell key={idx} {...spec} />
                        }
                    }
                    switch (spec.displayKind) {
                        case 'validation':
                            return <ValidationCell key={idx} {...spec} />
                        case 'required':
                            return <RequiredCell key={idx} {...spec} />
                    }
                })}

            {/* Menu */}
            {isMenuOpen && (
                <MenuComponent
                    sheetId={sheetId}
                    sheetIdx={sheetIdx}
                    blockId={blockId}
                    isOpen={isMenuOpen}
                    setIsOpen={setIsMenuOpen}
                    clickMousePosition={clickMousePosition}
                    setDescriptorUrl={setDescriptorUrl}
                    setError={setError}
                    setSuccessMessage={setSuccessMessage}
                    onModify={() => setEditComposerOpen(true)}
                    analyzes={analyzes}
                    analyzedBy={analyzedBy}
                    onGoToBlock={onGoToBlock}
                    onCreateAnalysis={handleCreateAnalysis}
                    onCreatePivot={
                        pivotSource && pivotSource.length > 1
                            ? () => setPivotDialog(true)
                            : undefined
                    }
                    onEditPivot={
                        isPivot && pivotContext ? openPivotEdit : undefined
                    }
                    onRefreshPivot={isPivot ? handleRefreshPivot : undefined}
                    pivotStaleCount={
                        pivotHealth && !('broken' in pivotHealth)
                            ? pivotHealth.missing
                            : undefined
                    }
                    onDelete={() =>
                        analyzedBy.length > 0
                            ? setDeleteConfirm(true)
                            : handleDelete()
                    }
                />
            )}

            {/* "Modify" → block composer in edit mode. Rendered here (not in the
                menu) so it stays mounted after the menu closes. */}
            {editComposerOpen && (
                <BlockComposerComponent
                    editTarget={{sheetIdx, sheetId, blockId}}
                    close={() => setEditComposerOpen(false)}
                />
            )}

            {/* Deleting a block deletes its analyses with it — an analysis of
                a block that no longer exists would sit there reading empty
                with nothing to say why. Named, so the user knows what goes. */}
            {pivotDialog && pivotSource && (
                <PivotDialog
                    sourceName={title}
                    fields={pivotSource}
                    keyIdx={pivotKeyIdx}
                    onCancel={() => setPivotDialog(false)}
                    onConfirm={handleCreatePivot}
                />
            )}

            {/* The same dialog over an existing recipe. Its fields are the
                SOURCE's, because that is what a recipe names. */}
            {pivotEdit && pivotContext && (
                <PivotDialog
                    sourceName={pivotContext.source.refName}
                    fields={pivotContext.fields}
                    keyIdx={pivotContext.keyIdx}
                    initial={pivotEdit}
                    onCancel={() => setPivotEdit(undefined)}
                    onConfirm={handleEditPivot}
                />
            )}

            {deleteConfirm && (
                <Dialog open onClose={() => setDeleteConfirm(false)}>
                    <DialogTitle>Delete “{title}”?</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2">
                            Its {analyzedBy.length} analysis block
                            {analyzedBy.length === 1 ? '' : 's'} (
                            {analyzedBy.map((a) => a.name).join(', ')}) will go
                            with it — every column of an analysis block
                            summarises this one, so none of them mean anything
                            without it. A single undo brings them all back.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteConfirm(false)}>
                            Cancel
                        </Button>
                        <Button color="error" onClick={handleDelete}>
                            Delete all
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </Box>
    )
})
