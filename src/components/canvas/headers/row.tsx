import React, {ReactElement, useRef, useState} from 'react'
import type {Grid} from '@/core/worker/types'
import {LeftTop} from '@/core/settings'
import {SelectedData} from '../events'
import {buildSelectedDataFromLines} from '../events'
import HeaderResizer from './resizer'
import HeaderContextMenu from './contextmenu'
import {ZINDEX_HEADER} from '@/components/const'

export interface RowHeadersProps {
    grid?: Grid
    setSelectedData: (data: SelectedData) => void
    selectedRowRange?: [number, number]
    onResizeRow?: (rowIdx: number, deltaPx: number) => void
    sheetIdx: number
    isEditing: boolean
    setReferenceWhenEditing: (data: SelectedData) => void
}
export const RowHeaders: React.FC<RowHeadersProps> = ({
    grid,
    setSelectedData,
    onResizeRow,
    sheetIdx,
    selectedRowRange,
    isEditing,
    setReferenceWhenEditing,
}) => {
    const hostRef = useRef<HTMLDivElement | null>(null)
    const [menuOpen, setMenuOpen] = useState(false)
    const [menuX, setMenuX] = useState(0)
    const [menuY, setMenuY] = useState(0)
    const [menuIdx, setMenuIdx] = useState<number | null>(null)
    const [menuCount, setMenuCount] = useState(1)

    const findRowIdxAt = (y: number): number | undefined => {
        if (!grid) return undefined
        let acc = 0
        for (const r of grid.rows) {
            acc += r.height
            if (y < acc) return r.idx
        }
        return grid.rows.at(-1)?.idx
    }

    const onContextMenuRow = (idx: number) => (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setMenuIdx(selectedRowRange ? selectedRowRange[0] : idx)
        setMenuX(e.clientX)
        setMenuY(e.clientY)
        setMenuOpen(true)
    }

    const onMouseDownRow = (downIdx: number) => (e: React.MouseEvent) => {
        // left-click only
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        if (!grid) return
        const onMove = (me: MouseEvent) => {
            const r = hostRef.current?.getBoundingClientRect()
            const y = me.clientY - (r?.top ?? 0)
            const currIdx = findRowIdxAt(y) ?? downIdx
            const start = Math.min(downIdx, currIdx)
            const end = Math.max(downIdx, currIdx)
            const data: SelectedData = buildSelectedDataFromLines(
                start,
                end,
                'row',
                'none'
            )
            if (isEditing) {
                setReferenceWhenEditing(data)
            } else {
                setSelectedData(data)
            }
        }
        const onUp = (ue: MouseEvent) => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
            const r = hostRef.current?.getBoundingClientRect()
            const y = ue.clientY - (r?.top ?? 0)
            const upIdx = findRowIdxAt(y) ?? downIdx
            const start = Math.min(downIdx, upIdx)
            const end = Math.max(downIdx, upIdx)
            const data: SelectedData = buildSelectedDataFromLines(
                start,
                end,
                'row',
                'none'
            )
            setMenuCount(end - start + 1)
            if (isEditing) {
                setReferenceWhenEditing(data)
            } else {
                setSelectedData(data)
            }
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }

    return (
        <div
            ref={hostRef}
            style={{
                position: 'absolute',
                left: 0,
                top: LeftTop.height,
                bottom: 0,
                width: LeftTop.width,
                overflow: 'hidden',
                background: '#fafafa',
                borderRight: '1px solid #e0e0e0',
                pointerEvents: 'auto',
                zIndex: ZINDEX_HEADER,
            }}
        >
            <div style={{position: 'relative', width: '100%'}}>
                {
                    grid?.rows?.reduce(
                        (acc: {y: number; nodes: ReactElement[]}, r) => {
                            const isSelected =
                                !!selectedRowRange &&
                                r.idx >= selectedRowRange[0] &&
                                r.idx <= selectedRowRange[1]
                            const node = (
                                <div
                                    key={r.idx}
                                    onMouseDown={onMouseDownRow(r.idx)}
                                    onContextMenu={onContextMenuRow(r.idx)}
                                    style={{
                                        position: 'absolute',
                                        top: acc.y,
                                        left: 0,
                                        height: r.height,
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: isSelected ? '#0d47a1' : '#333',
                                        fontSize: 12,
                                        borderBottom: '1px solid #eee',
                                        boxSizing: 'border-box',
                                        userSelect: 'none',
                                        pointerEvents: 'auto',
                                        background: isSelected
                                            ? '#e3f2fd'
                                            : undefined,
                                        fontWeight: isSelected
                                            ? 600
                                            : undefined,
                                    }}
                                >
                                    {r.idx + 1}
                                </div>
                            )
                            const handle = (
                                <HeaderResizer
                                    key={`res-row-${r.idx}`}
                                    orientation="row"
                                    x={0}
                                    y={acc.y + r.height}
                                    length={LeftTop.width}
                                    onResizeEnd={(dy) => {
                                        if (typeof onResizeRow === 'function') {
                                            onResizeRow(r.idx, dy)
                                        }
                                    }}
                                />
                            )
                            return {
                                y: acc.y + r.height,
                                nodes: [...acc.nodes, node, handle],
                            }
                        },
                        {y: 0, nodes: [] as ReactElement[]}
                    ).nodes
                }
                {menuOpen && menuIdx !== null && (
                    <HeaderContextMenu
                        x={menuX}
                        y={menuY}
                        type="row"
                        index={menuIdx}
                        count={menuCount}
                        sheetIdx={sheetIdx}
                        onClose={() => setMenuOpen(false)}
                        setSelectedData={setSelectedData}
                    />
                )}
            </div>
        </div>
    )
}

export default RowHeaders
