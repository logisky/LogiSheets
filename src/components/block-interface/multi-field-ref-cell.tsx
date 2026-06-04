import {useEffect, useState} from 'react'
import {Box, Select, MenuItem, Checkbox, ListItemText} from '@mui/material'
import {CellInputBuilder, Payload, isErrorMessage} from 'logisheets-engine'
import {useEngine} from '@/core/engine/provider'
import {tx} from '@/core/transaction'
import {BlockCellProps, valueToDisplayString} from './cell'
import {blockEditBus} from './edit-bus'
import {useEditable} from '@/core/permissions/use-editable'

// Storage convention for multiSelectRef cells: comma-separated values, each
// trimmed. Empty cell ↔ empty list. Values are not escaped — if a referenced
// field's values can contain commas, this format breaks; we'll revisit if it
// becomes an issue (the docker-compose use case — service names, network
// names — never contains commas).
const SEP = ','

const parseList = (raw: string): string[] => {
    if (raw.trim() === '') return []
    return raw
        .split(SEP)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
}

const serializeList = (items: string[]): string => items.join(SEP)

// Renders a multi-select dropdown picking N values from another block's
// field. Storage in the cell is a comma-separated string. Options are
// fetched at edit time from the target block's schema (same axis-walking
// logic as FieldRefCell).
export const MultiFieldRefCell = (props: BlockCellProps) => {
    const {x, y, width, height, value, fieldInfo, sheetIdx, rowIdx, colIdx} =
        props

    const t = fieldInfo.type
    const targetSheetId = t.type === 'multiSelectRef' ? t.sheetId : -1
    const targetBlockId = t.type === 'multiSelectRef' ? t.blockId : -1
    const targetFieldName = t.type === 'multiSelectRef' ? t.fieldName : ''

    const engine = useEngine()
    const DATA_SERVICE = engine.getDataService()
    const [isEditing, setIsEditing] = useState(false)
    const [options, setOptions] = useState<string[] | null>(null)

    useEffect(() => {
        if (!isEditing) return
        let cancelled = false
        DATA_SERVICE.getWorkbook()
            .getBlockInfo({sheetId: targetSheetId, blockId: targetBlockId})
            .then((info) => {
                if (cancelled || isErrorMessage(info)) return
                const schema = info.schema
                if (!schema) {
                    setOptions([])
                    return
                }
                const entry = schema.fields.find(
                    (f) => f.field === targetFieldName
                )
                if (!entry) {
                    setOptions([])
                    return
                }
                const targetCol = entry.idx
                const fieldCount = schema.fields.length
                const out: string[] = []
                const seen = new Set<string>()
                for (
                    let i = targetCol;
                    i < info.cells.length;
                    i += fieldCount
                ) {
                    const v = valueToDisplayString(info.cells[i].value)
                    if (v === '' || seen.has(v)) continue
                    seen.add(v)
                    out.push(v)
                }
                setOptions(out)
            })
        return () => {
            cancelled = true
        }
    }, [isEditing, targetSheetId, targetBlockId, targetFieldName])

    if (t.type !== 'multiSelectRef') {
        return null
    }

    const currentRaw = valueToDisplayString(value)
    const selected = parseList(currentRaw)
    const displayValue = selected.join(', ')

    const editable = useEditable(fieldInfo, sheetIdx, rowIdx, colIdx)

    const handleClick = () => {
        if (!editable) return
        setIsEditing(true)
    }

    const handleChange = async (next: string[]) => {
        const newContent = serializeList(next)
        const p = new CellInputBuilder()
            .sheetIdx(sheetIdx)
            .row(rowIdx)
            .col(colIdx)
            .content(newContent)
            .build()
        const payload: Payload = {type: 'cellInput', value: p}
        await DATA_SERVICE.handleTransaction(tx([payload], true))
        blockEditBus.emit({
            sheetIdx,
            rowIdx,
            colIdx,
            sheetId: fieldInfo.sheetId,
            blockId: fieldInfo.blockId,
            fieldId: fieldInfo.id,
            fieldName: fieldInfo.name,
            refName: fieldInfo.refName,
            newValue: newContent,
        })
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
                cursor: editable ? 'pointer' : 'not-allowed',
                opacity: editable ? 1 : 0.6,
                transition: 'all 0.2s',
                '&:hover': editable
                    ? {
                          borderColor: 'primary.light',
                          bgcolor: 'action.hover',
                      }
                    : {},
                pointerEvents: 'auto',
                zIndex: isEditing ? 1000 : 1,
            }}
            onClick={!isEditing ? handleClick : undefined}
        >
            {isEditing ? (
                <Select
                    multiple
                    open
                    autoFocus
                    fullWidth
                    size="small"
                    value={selected}
                    onChange={(e) => {
                        const v = e.target.value
                        const next = typeof v === 'string' ? v.split(SEP) : v
                        handleChange(next as string[])
                    }}
                    onClose={() => setIsEditing(false)}
                    renderValue={(picked) => (picked as string[]).join(', ')}
                    sx={{
                        height: '100%',
                        fontSize: '0.75rem',
                        '& .MuiSelect-select': {
                            py: 0.25,
                            px: 0.75,
                            display: 'flex',
                            alignItems: 'center',
                        },
                    }}
                    MenuProps={{
                        PaperProps: {
                            sx: {
                                maxHeight: 240,
                                '& .MuiMenuItem-root': {
                                    fontSize: '0.75rem',
                                    py: 0.25,
                                    px: 1,
                                },
                            },
                        },
                    }}
                >
                    {options === null ? (
                        <MenuItem disabled value="">
                            <em>Loading…</em>
                        </MenuItem>
                    ) : options.length === 0 ? (
                        <MenuItem disabled value="">
                            <em>No values yet</em>
                        </MenuItem>
                    ) : (
                        options.map((opt) => (
                            <MenuItem key={opt} value={opt}>
                                <Checkbox
                                    size="small"
                                    checked={selected.includes(opt)}
                                />
                                <ListItemText primary={opt} />
                            </MenuItem>
                        ))
                    )}
                </Select>
            ) : (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 0.75,
                        height: '100%',
                        fontSize: '0.75rem',
                        color: 'text.primary',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {displayValue}
                </Box>
            )}
        </Box>
    )
}
