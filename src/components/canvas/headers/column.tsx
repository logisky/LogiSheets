import React, {ReactElement, useRef, useState} from 'react'
import type {Grid} from '@/core/worker/types'
import {LeftTop} from '@/core/settings'
import {toA1notation} from '@/core'
import {SelectedData} from '../events'
import {buildSelectedDataFromLines} from '../events'
import HeaderResizer from './resizer'
import HeaderContextMenu from './contextmenu'
import {ZINDEX_HEADER, ZINDEX_UI} from '@/components/const'

export interface ColumnHeadersProps {
    grid?: Grid
    setSelectedData: (data: SelectedData) => void
    onResizeCol?: (colIdx: number, deltaPx: number) => void
    sheetIdx: number
    selectedColRange?: [number, number]
}

export const ColumnHeaders: React.FC<ColumnHeadersProps> = ({
    grid,
    setSelectedData,
    onResizeCol,
    sheetIdx,
    selectedColRange,
}) => {
    const hostRef = useRef<HTMLDivElement | null>(null)
    const [menuOpen, setMenuOpen] = useState(false)
    const [menuX, setMenuX] = useState(0)
    const [menuY, setMenuY] = useState(0)
    const [menuIdx, setMenuIdx] = useState<number | null>(null)
    const [menuCount, setMenuCount] = useState(1)

    const findColIdxAt = (x: number): number | undefined => {
        if (!grid) return undefined
        let acc = 0
        for (const c of grid.columns) {
            acc += c.width
            if (x < acc) return c.idx
        }
        return grid.columns.at(-1)?.idx
    }

    const onMouseDownCol = (downIdx: number) => (e: React.MouseEvent) => {
        // left-click only
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        if (!grid) return
        const onMove = (me: MouseEvent) => {
            const r = hostRef.current?.getBoundingClientRect()
            const x = me.clientX - (r?.left ?? 0)
            const currIdx = findColIdxAt(x) ?? downIdx
            const start = Math.min(downIdx, currIdx)
            const end = Math.max(downIdx, currIdx)
            const data: SelectedData = buildSelectedDataFromLines(
                start,
                end,
                'col',
                'none'
            )
            setSelectedData(data)
        }
        const onUp = (ue: MouseEvent) => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
            const r = hostRef.current?.getBoundingClientRect()
            const x = ue.clientX - (r?.left ?? 0)
            const upIdx = findColIdxAt(x) ?? downIdx
            const start = Math.min(downIdx, upIdx)
            const end = Math.max(downIdx, upIdx)
            const data: SelectedData = buildSelectedDataFromLines(
                start,
                end,
                'col',
                'none'
            )
            setMenuCount(end - start + 1)
            setSelectedData(data)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }

    const onContextMenuCol = (idx: number) => (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setMenuIdx(idx)
        setMenuX(e.clientX)
        setMenuY(e.clientY)
        setMenuOpen(true)
    }

    return (
        <div
            ref={hostRef}
            style={{
                position: 'absolute',
                left: LeftTop.width,
                right: 0,
                top: 0,
                height: LeftTop.height,
                overflow: 'hidden',
                background: '#fafafa',
                borderBottom: '1px solid #e0e0e0',
                pointerEvents: 'auto',
                zIndex: ZINDEX_HEADER,
            }}
        >
            <div style={{position: 'relative', height: '100%'}}>
                {
                    grid?.columns?.reduce(
                        (acc: {x: number; nodes: ReactElement[]}, c) => {
                            const label = toA1notation(c.idx)
                            const isSelected =
                                !!selectedColRange &&
                                c.idx >= selectedColRange[0] &&
                                c.idx <= selectedColRange[1]
                            const node = (
                                <div
                                    key={c.idx}
                                    onMouseDown={onMouseDownCol(c.idx)}
                                    onContextMenu={onContextMenuCol(c.idx)}
                                    style={{
                                        position: 'absolute',
                                        left: acc.x,
                                        top: 0,
                                        width: c.width,
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: isSelected ? '#0d47a1' : '#333',
                                        fontSize: 12,
                                        borderRight: '1px solid #eee',
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
                                    {label}
                                </div>
                            )
                            const handle = (
                                <HeaderResizer
                                    key={`res-col-${c.idx}`}
                                    orientation="col"
                                    x={acc.x + c.width}
                                    y={0}
                                    length={LeftTop.height}
                                    onResizeEnd={(dx) => {
                                        // commit via parent
                                        if (typeof onResizeCol === 'function') {
                                            onResizeCol(c.idx, dx)
                                        }
                                    }}
                                />
                            )
                            return {
                                x: acc.x + c.width,
                                nodes: [...acc.nodes, node, handle],
                            }
                        },
                        {x: 0, nodes: [] as ReactElement[]}
                    ).nodes
                }
                {menuOpen && menuIdx !== null && (
                    <HeaderContextMenu
                        open={menuOpen}
                        x={menuX}
                        y={menuY}
                        type="col"
                        index={menuIdx}
                        sheetIdx={sheetIdx}
                        count={menuCount}
                        onClose={() => setMenuOpen(false)}
                    />
                )}
            </div>
        </div>
    )
}

export default ColumnHeaders
