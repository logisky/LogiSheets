import {useEffect, useState} from 'react'
import {observer} from 'mobx-react-lite'
import {toast} from 'react-toastify'
import {globalStore} from '@/store'
import {Box, IconButton, Tooltip, Typography} from '@mui/material'
import {Settings as SettingsIcon, Add as AddIcon} from '@mui/icons-material'
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
import {useEngine, useOps, useDataService} from '@/core/engine/provider'
import type {FieldInfo} from 'logisheets-engine'
import {BlockCellInfo, BlockDisplayInfo} from 'logisheets-engine'
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
    const {grid, canvasStartX, canvasStartY} = props
    const engine = useEngine()
    const BLOCK_MANAGER = engine.getBlockManager()

    if (!grid.blockInfos || grid.blockInfos.length === 0) {
        return null
    }

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

                const sortedFields = [...info.schema.fields].sort(
                    (a, b) => a.idx - b.idx
                )
                const fieldInfos = sortedFields.map((f) =>
                    BLOCK_MANAGER.fieldManager.get(f.renderId)
                )
                if (fieldInfos.some((f) => !f)) return null
                const safeFieldInfos = fieldInfos as NonNullable<
                    (typeof fieldInfos)[number]
                >[]

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
                {/* Main border */}
                <Box
                    sx={{
                        position: 'absolute',
                        inset: '6px',
                        border: '2px solid',
                        borderColor: showInfo
                            ? 'rgb(103, 58, 183)'
                            : 'rgba(103, 58, 183, 0.5)',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s',
                        pointerEvents: 'none',
                        borderRadius: '4px',
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
                    keeps the title and field name headers visible. */}
                {isHover && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: '-12px',
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
                {showInfo && title && (
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
                        </Typography>
                    </Box>
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
                                    title={f.description || fieldName}
                                    arrow
                                >
                                    <Box
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
                    </Box>
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
            {!isDragging && renderedCells.map((spec, idx) => {
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
                />
            )}
        </Box>
    )
})
