import {
    adjustPointAllocation,
    getPointAllocation,
    getPointAllocatorBindings,
} from '@/core/craft-interactions'
import type {CellResolver} from './cell-rect'

export interface PointAllocatorLayerProps {
    activeSheet: number
    resolver: CellResolver
}

export const PointAllocatorLayer = ({
    activeSheet,
    resolver,
}: PointAllocatorLayerProps) => {
    const bindings = getPointAllocatorBindings().filter(
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
                const points = getPointAllocation(binding)

                const onClick = (e: React.MouseEvent) => {
                    e.preventDefault()
                    e.stopPropagation()
                    adjustPointAllocation(binding, e.shiftKey ? -1 : 1)
                }
                const onContext = (e: React.MouseEvent) => {
                    e.preventDefault()
                    e.stopPropagation()
                    adjustPointAllocation(binding, e.shiftKey ? -5 : 5)
                }

                return (
                    <div
                        key={`point-${binding.groupId}-${binding.blockId}-${binding.row}-${binding.col}`}
                        title="Left-click +1, right-click +5, hold Shift to subtract"
                        style={{
                            position: 'absolute',
                            left: rect.x,
                            top: rect.y,
                            width: rect.width,
                            height: rect.height,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            pointerEvents: 'auto',
                            zIndex: 100,
                            userSelect: 'none',
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#512da8',
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={onClick}
                        onContextMenu={onContext}
                    >
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                background: 'rgb(103, 58, 183)',
                                color: '#fff',
                                lineHeight: 1,
                            }}
                        >
                            +
                        </span>
                        <span>{points}</span>
                    </div>
                )
            })}
        </>
    )
}
