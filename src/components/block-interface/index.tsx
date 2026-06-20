import {useEffect, useState} from 'react'
import {observer} from 'mobx-react-lite'
import {globalStore} from '@/store'
import {Box, IconButton, Tooltip, Typography} from '@mui/material'
import {Settings as SettingsIcon, Add as AddIcon} from '@mui/icons-material'
import {
    Grid,
    DataService,
    BlockManager,
    xForColStart,
    xForColEnd,
    yForRowStart,
    yForRowEnd,
} from 'logisheets-engine'
import {ZINDEX_BLOCK_OUTLINER} from '../const'
import {MenuComponent} from './menu'
import {useEngine} from '@/core/engine/provider'
import type {FieldInfo} from 'logisheets-engine'
import {
    BlockCellInfo,
    InsertRowsInBlockBuilder,
    BlockDisplayInfo,
} from 'logisheets-engine'
import {tx} from '@/core/transaction'
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

export const BlockInterfaceComponent = (props: BlockInterfaceProps) => {
    const {grid, canvasStartX, canvasStartY} = props
    const engine = useEngine()
    const DATA_SERVICE = engine.getDataService()
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
                        colStart={info.colStart}
                        rowStart={info.rowStart}
                        dataService={DATA_SERVICE}
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
    colStart: number
    rowStart: number
    dataService: DataService
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
        colStart,
        rowStart,
        title,
        dataService,
        blockManager,
        canvasStartX,
        canvasStartY,
        cells,
        grid,
    } = props

    const [isHover, setIsHover] = useState(false)
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

        const payload = new InsertRowsInBlockBuilder()
            .sheetIdx(sheetIdx)
            .blockId(blockId)
            .cnt(1)
            .start(rowCnt)
            .build()

        await dataService.handleTransaction(
            tx(
                [
                    {
                        type: 'insertRowsInBlock',
                        value: payload,
                    },
                ],
                true
            )
        )
    }

    return (
        <Box
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
                categories never collide. */}
            {renderedCells.map((spec, idx) => {
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
