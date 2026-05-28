import {useEffect, useState} from 'react'
import {Box, Select, MenuItem} from '@mui/material'
import {CellInputBuilder, Payload, isErrorMessage} from 'logisheets-engine'
import {useEngine} from '@/core/engine/provider'
import {tx} from '@/core/transaction'
import {BlockCellProps, valueToDisplayString} from './cell'
import {blockEditBus} from './edit-bus'

// Renders a dropdown whose options are pulled at edit time from another
// block's field. The referenced field is guaranteed unique by the composer
// (only fields with `unique: true` on FieldInfo are eligible targets), so
// the cell stores the raw value verbatim — no id↔label split. Existence is
// enforced by an auto-injected COUNTIF >= 1 validation, so a dangling
// reference surfaces as a warning indicator on top of the cell.
export const FieldRefCell = (props: BlockCellProps) => {
    const {x, y, width, height, value, fieldInfo, sheetIdx, rowIdx, colIdx} =
        props

    // Pull target metadata up here so all hooks below see consistent
    // dependencies. Non-fieldRef types are filtered upstream by the
    // dispatcher; the nullish fallbacks are just to keep useEffect's deps
    // well-typed for the impossible case.
    const t = fieldInfo.type
    const targetSheetId = t.type === 'fieldRef' ? t.sheetId : -1
    const targetBlockId = t.type === 'fieldRef' ? t.blockId : -1
    const targetFieldName = t.type === 'fieldRef' ? t.fieldName : ''

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
                // Cells are laid out row-major: idx = row * fieldCount + col.
                // Step by `fieldCount` to walk the target column.
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

    if (t.type !== 'fieldRef') {
        return null
    }

    const currentValue = valueToDisplayString(value)

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
            newValue,
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
                        },
                    }}
                    MenuProps={{
                        PaperProps: {
                            sx: {
                                maxHeight: 240,
                                '& .MuiMenuItem-root': {
                                    fontSize: '0.75rem',
                                    py: 0.5,
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
                                {opt}
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
                    }}
                >
                    {currentValue}
                </Box>
            )}
        </Box>
    )
}
