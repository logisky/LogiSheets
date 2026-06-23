import {useCallback, useRef, useState} from 'react'
import {CellInputBuilder, Payload, type BlockDisplayInfo} from 'logisheets-engine'
import {useEngine} from '@/core/engine/provider'
import {tx} from '@/core/transaction'
import {
    getNumberSliderBindings,
    type NumberSliderBinding,
} from 'logisheets-core'
import type {CellResolver} from './cell-rect'
import type {Grid} from 'logisheets-engine'

export interface NumberSliderLayerProps {
    activeSheet: number
    resolver: CellResolver
    grid: Grid
}

export const NumberSliderLayer = ({
    activeSheet,
    resolver,
    grid,
}: NumberSliderLayerProps) => {
    const bindings = getNumberSliderBindings().filter(
        (b) => b.sheetIdx === activeSheet
    )
    if (bindings.length === 0) return null

    return (
        <>
            {bindings.map((binding) => {
                const rect = resolver.rect(
                    binding.blockId,
                    binding.row,
                    binding.col
                )
                if (!rect) return null

                // Resolve block-relative row/col to absolute sheet row/col
                const blockInfo = grid.blockInfos?.find(
                    (bi: BlockDisplayInfo) => bi.info.blockId === binding.blockId
                )
                if (!blockInfo) return null
                const absRow = blockInfo.info.rowStart + binding.row
                const absCol = blockInfo.info.colStart + binding.col

                return (
                    <NumberSliderCell
                        key={`ns-${binding.groupId}-${binding.blockId}-${binding.row}-${binding.col}`}
                        binding={binding}
                        rect={rect}
                        absRow={absRow}
                        absCol={absCol}
                    />
                )
            })}
        </>
    )
}

interface NumberSliderCellProps {
    binding: NumberSliderBinding
    rect: {x: number; y: number; width: number; height: number}
    absRow: number
    absCol: number
}

const NumberSliderCell = ({
    binding,
    rect,
    absRow,
    absCol,
}: NumberSliderCellProps) => {
    const engine = useEngine()
    const DATA_SERVICE = engine.getDataService()

    const step = binding.step ?? 1
    const clamp = (v: number) =>
        Math.min(binding.max, Math.max(binding.min, v))

    const [value, setValue] = useState<number>(
        clamp(binding.initialValue ?? binding.min)
    )
    const [isEditing, setIsEditing] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const [inputText, setInputText] = useState('')

    // Debounce scroll transactions: accumulate delta and fire after quiet period
    const pendingValueRef = useRef<number | null>(null)
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const sendTransaction = useCallback(
        (v: number) => {
            const payload: Payload = {
                type: 'cellInput',
                value: new CellInputBuilder()
                    .sheetIdx(binding.sheetIdx)
                    .row(absRow)
                    .col(absCol)
                    .content(String(v))
                    .build(),
            }
            DATA_SERVICE.handleTransaction(tx([payload], true))
        },
        [DATA_SERVICE, binding.sheetIdx, absRow, absCol]
    )

    const onWheel = (e: React.WheelEvent) => {
        e.preventDefault()
        e.stopPropagation()

        const delta = e.deltaY > 0 ? -step : step
        const next = clamp(value + delta)
        setValue(next)
        pendingValueRef.current = next

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = setTimeout(() => {
            if (pendingValueRef.current !== null) {
                sendTransaction(pendingValueRef.current)
                pendingValueRef.current = null
            }
        }, 120)
    }

    const commitInput = () => {
        const parsed = parseFloat(inputText)
        if (!isNaN(parsed)) {
            const next = clamp(parsed)
            setValue(next)
            sendTransaction(next)
        }
        setIsEditing(false)
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') commitInput()
        if (e.key === 'Escape') setIsEditing(false)
    }

    const onClickDisplay = (e: React.MouseEvent) => {
        e.stopPropagation()
        setInputText(String(value))
        setIsEditing(true)
    }

    const fraction = (value - binding.min) / (binding.max - binding.min || 1)

    return (
        <div
            style={{
                position: 'absolute',
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
                boxSizing: 'border-box',
                pointerEvents: 'auto',
                zIndex: 100,
                userSelect: 'none',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onMouseDown={(e) => e.stopPropagation()}
            onWheel={onWheel}
        >
            {/* Progress fill */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(to right, rgba(99,102,241,0.15) ${fraction * 100}%, transparent ${fraction * 100}%)`,
                    borderRadius: 2,
                    pointerEvents: 'none',
                }}
            />

            {isEditing ? (
                <input
                    autoFocus
                    type="number"
                    value={inputText}
                    min={binding.min}
                    max={binding.max}
                    step={step}
                    onChange={(e) => setInputText(e.target.value)}
                    onBlur={commitInput}
                    onKeyDown={onKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        border: '2px solid #6366f1',
                        borderRadius: 2,
                        background: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        textAlign: 'center',
                        outline: 'none',
                        boxSizing: 'border-box',
                        padding: '0 4px',
                    }}
                />
            ) : (
                <div
                    onClick={onClickDisplay}
                    title={`Scroll to adjust · click to type · range [${binding.min}, ${binding.max}]`}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        cursor: 'ns-resize',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#4338ca',
                        border: isHovered
                            ? '1px solid #6366f1'
                            : '1px solid transparent',
                        borderRadius: 2,
                        transition: 'border-color 0.15s',
                    }}
                >
                    {isHovered && (
                        <span
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                lineHeight: 1,
                                fontSize: 8,
                                opacity: 0.6,
                            }}
                        >
                            <span>▲</span>
                            <span>▼</span>
                        </span>
                    )}
                    <span>{value}</span>
                </div>
            )}
        </div>
    )
}
