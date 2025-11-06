import React, {useState} from 'react'
import {Box, Select, MenuItem} from '@mui/material'
import {CellInputBuilder, Payload, Transaction, Value} from 'logisheets-web'
import {DataServiceImpl, FieldInfo} from '@/core/data'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {CraftManager} from '@/core/data/craft'

export interface BlockCellProps {
    x: number
    y: number
    width: number
    height: number
    value: Value
    fieldInfo: FieldInfo
    sheetIdx: number
    rowIdx: number
    colIdx: number
}

// Helper function to extract string from Value (for enum variant id)
const valueToString = (val: Value): string => {
    if (val === 'empty') return ''
    if (val.type === 'str') return val.value
    return ''
}

export const BlockCell = (props: BlockCellProps) => {
    const {x, y, width, height, value, fieldInfo, sheetIdx, rowIdx, colIdx} =
        props

    const CRAFT_MANAGER = useInjection<CraftManager>(TYPES.CraftManager)
    const DATA_SERVICE = useInjection<DataServiceImpl>(TYPES.Data)
    const [isEditing, setIsEditing] = useState(false)

    // Only handle enum type
    if (fieldInfo.type.type !== 'enum') {
        return null
    }

    const enumId = fieldInfo.type.id
    const variantId = valueToString(value) // This is the enum variant id

    // Get enum info and find the current variant
    const enumInfo = CRAFT_MANAGER.enumSetManager.get(enumId)
    const currentVariant = enumInfo?.variants.find((v) => v.id === variantId)
    const displayValue = currentVariant?.value || ''

    const handleClick = () => {
        setIsEditing(true)
    }

    const handleChange = async (newVariantId: string) => {
        setIsEditing(false)
        const p = new CellInputBuilder()
            .sheetIdx(sheetIdx)
            .row(rowIdx)
            .col(colIdx)
            .content(newVariantId)
            .build()
        const payload: Payload = {
            type: 'cellInput',
            value: p,
        }
        await DATA_SERVICE.handleTransaction(new Transaction([payload], true))
    }

    return (
        <Box
            sx={{
                position: 'absolute',
                left: `${x}px`,
                top: `${y}px`,
                width: `${width}px`,
                height: `${height}px`,
                border: '1px solid',
                borderColor: isEditing ? 'primary.main' : 'divider',
                bgcolor: isEditing ? 'background.paper' : 'transparent',
                boxSizing: 'border-box',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                    borderColor: 'primary.light',
                    bgcolor: 'action.hover',
                },
                pointerEvents: 'auto',
                zIndex: isEditing ? 1000 : 1,
            }}
            onClick={!isEditing ? handleClick : undefined}
        >
            {isEditing ? (
                <Select
                    open
                    autoFocus
                    fullWidth
                    size="small"
                    value={variantId}
                    onChange={(e) => handleChange(e.target.value as string)}
                    onClose={() => setIsEditing(false)}
                    sx={{
                        height: '100%',
                        fontSize: '0.75rem',
                        '& .MuiSelect-select': {
                            py: 0.25,
                            px: 0.75,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                        },
                    }}
                    MenuProps={{
                        PaperProps: {
                            sx: {
                                maxHeight: 200,
                                '& .MuiMenuItem-root': {
                                    fontSize: '0.75rem',
                                    py: 0.5,
                                    px: 1,
                                },
                            },
                        },
                    }}
                >
                    {enumInfo?.variants.map((variant) => (
                        <MenuItem key={variant.id} value={variant.id}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.75,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        bgcolor: variant.color,
                                        flexShrink: 0,
                                    }}
                                />
                                {variant.value}
                            </Box>
                        </MenuItem>
                    ))}
                </Select>
            ) : (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        px: 0.75,
                        height: '100%',
                        fontSize: '0.75rem',
                        color: 'text.primary',
                    }}
                >
                    {currentVariant && (
                        <Box
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: currentVariant.color,
                                flexShrink: 0,
                            }}
                        />
                    )}
                    {displayValue}
                </Box>
            )}
        </Box>
    )
}
