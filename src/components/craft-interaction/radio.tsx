import {Radio} from '@mui/material'
import {
    getRadioBindings,
    getRadioSelection,
    setRadioSelection,
    type RadioBinding,
} from 'logisheets-core'
import type {CellResolver} from './cell-rect'

export interface RadioLayerProps {
    activeSheet: number
    resolver: CellResolver
}

export const RadioLayer = ({activeSheet, resolver}: RadioLayerProps) => {
    const bindings = getRadioBindings().filter(
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
                const selected = getRadioSelection(binding.groupId)

                return (
                    <div
                        key={`radio-${binding.groupId}-${binding.blockId}-${binding.row}-${binding.col}`}
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
                        <Radio
                            size="small"
                            checked={selected === binding.value}
                            onChange={() =>
                                setRadioSelection(
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

export type {RadioBinding}
