import {useState} from 'react'
import {Box, Select, MenuItem} from '@mui/material'
import {CellInputBuilder, Payload, Transaction} from 'logisheets-web'
import {DataServiceImpl} from '@/core/data'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {BlockCellProps, valueToNumber} from './cell'

export const BoolCell = (props: BlockCellProps) => {
    const {x, y, width, height, value, fieldInfo, sheetIdx, rowIdx, colIdx} =
        props

    const DATA_SERVICE = useInjection<DataServiceImpl>(TYPES.Data)
    const [isEditing, setIsEditing] = useState(false)

    if (fieldInfo.type.type !== 'boolean') {
        return null
    }

    const numValue = valueToNumber(value)
    const currentValue = numValue === 1 ? '1' : numValue === 0 ? '0' : ''
    const displayIcon =
        currentValue === '1' ? '✅' : currentValue === '0' ? '❌' : ''

    const handleClick = () => {
        setIsEditing(true)
    }

    const handleChange = async (newValue: string) => {
        setIsEditing(false)
        const p = new CellInputBuilder()
            .sheetIdx(sheetIdx)
            .row(rowIdx)
            .col(colIdx)
            .content(newValue)
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
                    value={currentValue}
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
                            justifyContent: 'center',
                        },
                    }}
                    MenuProps={{
                        PaperProps: {
                            sx: {
                                '& .MuiMenuItem-root': {
                                    fontSize: '0.75rem',
                                    py: 0.5,
                                    px: 1,
                                    justifyContent: 'center',
                                },
                            },
                        },
                    }}
                >
                    <MenuItem value="1">
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.75,
                            }}
                        >
                            <span style={{fontSize: '0.9rem'}}>✅</span>
                            <span>True</span>
                        </Box>
                    </MenuItem>
                    <MenuItem value="0">
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.75,
                            }}
                        >
                            <span style={{fontSize: '0.9rem'}}>❌</span>
                            <span>False</span>
                        </Box>
                    </MenuItem>
                </Select>
            ) : (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        fontSize: '0.9rem',
                    }}
                >
                    {displayIcon}
                </Box>
            )}
        </Box>
    )
}
