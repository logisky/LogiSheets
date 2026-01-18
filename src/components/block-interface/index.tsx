import {useEffect, useState} from 'react'
import {Box, IconButton, Tooltip, Typography} from '@mui/material'
import {Settings as SettingsIcon, Add as AddIcon} from '@mui/icons-material'
import {Grid} from '@/core/worker/types'
import {ZINDEX_BLOCK_OUTLINER} from '../const'
import {MenuComponent} from './menu'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {DataServiceImpl as DataService} from '@/core/data'
import {BlockManager, FieldInfo} from '@/core/data/block'
import {
    BlockCellInfo,
    InsertRowsInBlockBuilder,
    Transaction,
} from 'logisheets-web'
import {
    xForColEnd,
    xForColStart,
    yForRowEnd,
    yForRowStart,
} from '../canvas/grid_helper'
import {LeftTop} from '@/core/settings'
import {BlockCellProps} from './cell'
import {EnumCell} from './enum-cell'
import {BoolCell} from './bool-cell'
import {ValidationCell} from './validation-cell'
import {DatetimeCell} from './datetime-cell'
import {ImageCell} from './image'

export interface BlockInterfaceProps {
    grid: Grid
    canvasStartX: number
    canvasStartY: number
}

export const BlockInterfaceComponent = (props: BlockInterfaceProps) => {
    const {grid, canvasStartX, canvasStartY} = props
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const BLOCK_MANAGER = useInjection<BlockManager>(TYPES.BlockManager)

    if (!grid.blockInfos || grid.blockInfos.length === 0) {
        return null
    }

    return (
        <>
            {grid.blockInfos.map((blockDisplay) => {
                const {info} = blockDisplay
                const x = xForColStart(info.colStart, grid)
                const y = yForRowStart(info.rowStart, grid)
                const width =
                    xForColEnd(info.colStart + info.colCnt - 1, grid) - x
                const height =
                    yForRowEnd(info.rowStart + info.rowCnt - 1, grid) - y

                if (!info.schema) {
                    throw new Error(
                        `Schema not found in block ${info.blockId} on sheet ${info.sheetId}`
                    )
                }

                const fieldInfos = [...info.schema.fields]
                    .sort((a, b) => a.idx - b.idx)
                    .map((fieldEntry, _idx) => {
                        const result = BLOCK_MANAGER.fieldManager.get(
                            fieldEntry.field
                        )

                        if (!result) {
                            throw new Error(
                                `Field ${fieldEntry.field} not found in block ${info.blockId}`
                            )
                        }

                        return result
                    })

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
                        fieldInfo={fieldInfos}
                        rowCnt={info.rowCnt}
                        colStart={info.colStart}
                        rowStart={info.rowStart}
                        dataService={DATA_SERVICE}
                        blockManager={BLOCK_MANAGER}
                        canvasStartX={canvasStartX}
                        canvasStartY={canvasStartY}
                        cells={info.cells}
                        grid={grid}
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
}

const BlockInterface = (props: BlockInterfaceInternalProps) => {
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
        dataService,
        blockManager,
        canvasStartX,
        canvasStartY,
        cells,
        grid,
    } = props

    const [isHover, setIsHover] = useState(false)
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

            const expandedTop = isHover ? -50 : -6
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

    const blockCellProps: BlockCellProps[] = cells.map((cell, idx) => {
        const rowIdx = Math.floor(idx / fieldInfo.length)
        const colIdx = idx % fieldInfo.length
        const x = xForColStart(colStart + colIdx, grid) - baseX
        const y = yForRowStart(rowStart + rowIdx, grid) - baseY
        const width = grid.columns[colIdx + colStart].width
        const height = grid.rows[rowIdx + rowStart].height
        const f = fieldInfo[colIdx]
        return {
            x,
            y,
            width,
            height,
            value: cell.value,
            shadowValue: cell.shadowValue,
            fieldInfo: f,
            rowIdx: rowIdx + rowStart,
            colIdx: colIdx + colStart,
            sheetIdx,
        } as BlockCellProps
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
            new Transaction(
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
                        borderColor: isHover
                            ? 'rgb(103, 58, 183)'
                            : 'rgba(103, 58, 183, 0.5)',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s',
                        pointerEvents: 'none',
                        borderRadius: '4px',
                    }}
                />

                {/* Settings button (top right) */}
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

                {/* Field headers (top) */}
                {isHover && fieldInfo.length > 0 && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: '-40px',
                            left: '6px',
                            right: '6px',
                            height: '32px',
                            display: 'flex',
                            gap: '1px',
                            pointerEvents: 'none',
                        }}
                    >
                        {fieldInfo.map((f, idx) => {
                            const fieldName = f.name || 'Unnamed'

                            const width = grid.columns[idx + colStart].width

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

                {/* Add row button (bottom) */}
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

            {/* Block cells */}
            {blockCellProps.map((cellProps, idx) => {
                const {fieldInfo} = cellProps
                if (fieldInfo.type.type === 'enum') {
                    return <EnumCell key={idx} {...cellProps} />
                } else if (fieldInfo.type.type === 'number') {
                    return (
                        <ValidationCell
                            key={idx}
                            {...cellProps}
                            fieldType="number"
                        />
                    )
                } else if (fieldInfo.type.type === 'boolean') {
                    return <BoolCell key={idx} {...cellProps} />
                } else if (fieldInfo.type.type === 'string') {
                    return (
                        <ValidationCell
                            key={idx}
                            {...cellProps}
                            fieldType="string"
                        />
                    )
                } else if (fieldInfo.type.type === 'datetime') {
                    return <DatetimeCell key={idx} {...cellProps} />
                } else if (fieldInfo.type.type === 'image') {
                    return <ImageCell key={idx} {...cellProps} />
                }
                return null
            })}

            {/* Menu */}
            {isMenuOpen && (
                <MenuComponent
                    sheetId={sheetId}
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
}
