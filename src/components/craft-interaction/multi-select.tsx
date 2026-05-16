import {Checkbox} from '@mui/material'
import {
    getMultiSelectBindings,
    getMultiSelectMax,
    getMultiSelectSelections,
    toggleMultiSelectValue,
} from '@/core/craft-interactions'
import type {CellResolver} from './cell-rect'

export interface MultiSelectLayerProps {
    activeSheet: number
    resolver: CellResolver
}

export const MultiSelectLayer = ({
    activeSheet,
    resolver,
}: MultiSelectLayerProps) => {
    const bindings = getMultiSelectBindings().filter(
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
                const selections = new Set(
                    getMultiSelectSelections(binding.groupId)
                )
                const checked = selections.has(binding.value)
                const max = getMultiSelectMax(binding.groupId)
                const atCap = !checked && max > 0 && selections.size >= max

                return (
                    <div
                        key={`multi-${binding.groupId}-${binding.blockId}-${binding.row}-${binding.col}`}
                        style={{
                            position: 'absolute',
                            left: rect.x,
                            top: rect.y,
                            width: rect.width,
                            height: rect.height,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'auto',
                            zIndex: 100,
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <Checkbox
                            size="small"
                            checked={checked}
                            disabled={atCap}
                            onChange={() =>
                                toggleMultiSelectValue(
                                    binding.groupId,
                                    binding.value
                                )
                            }
                        />
                    </div>
                )
            })}
        </>
    )
}
