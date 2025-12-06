import {useMemo, useState, forwardRef, useImperativeHandle} from 'react'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {DataServiceImpl} from '@/core/data'
import {
    Payload,
    Transaction,
    SetCellNumFmtBuilder,
    SetLineNumFmtBuilder,
    SelectedData,
} from 'logisheets-web'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import Typography from '@mui/material/Typography'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import TextField from '@mui/material/TextField'

export interface NumFmtPanelProps {
    // current format code, e.g., 'General', '0.00', '#,##0', 'mm-dd-yy', etc.
    value?: string
    // called whenever user picks a format (including typing custom)
    onChange?: (fmt: string) => void
    // whether to show actions row (OK/Cancel). Default true
    showActions?: boolean
    // Optional width/height overrides
    width?: number | string
    height?: number | string
    // selection context to apply formatting
    selectedData: SelectedData
}

type Preset = {id: number; label: string; fmt: string; example?: string}

const presetCategories: Record<string, Preset[]> = {
    General: [{id: 0, label: 'General', fmt: 'General', example: '1234.56'}],
    Number: [
        {id: 1, label: '0', fmt: '0', example: '1235'},
        {id: 2, label: '0.00', fmt: '0.00', example: '1234.56'},
        {id: 3, label: '#,##0', fmt: '#,##0', example: '1,235'},
        {id: 4, label: '#,##0.00', fmt: '#,##0.00', example: '1,234.56'},
        {id: 9, label: '0%', fmt: '0%', example: '12%'},
        {id: 10, label: '0.00%', fmt: '0.00%', example: '12.35%'},
        {id: 11, label: '0.00E+00', fmt: '0.00E+00', example: '1.23E+03'},
    ],
    Accounting: [{id: 48, label: 'Scientific (##0.00E+0)', fmt: '##0.00E+0'}],
    Date: [
        {id: 14, label: 'mm-dd-yy', fmt: 'mm-dd-yy', example: '03-14-12'},
        {id: 15, label: 'd-mmm-yy', fmt: 'd-mmm-yy', example: '14-Mar-12'},
        {id: 16, label: 'd-mmm', fmt: 'd-mmm', example: '14-Mar'},
        {id: 17, label: 'mmm-yy', fmt: 'mmm-yy', example: 'Mar-12'},
        {id: 22, label: 'm/d/yy h:mm', fmt: 'm/d/yy h:mm'},
    ],
    Time: [
        {id: 18, label: 'h:mm AM/PM', fmt: 'h:mm AM/PM', example: '1:30 PM'},
        {id: 19, label: 'h:mm:ss AM/PM', fmt: 'h:mm:ss AM/PM'},
        {id: 20, label: 'h:mm', fmt: 'h:mm'},
        {id: 21, label: 'h:mm:ss', fmt: 'h:mm:ss'},
        {id: 45, label: 'mm:ss', fmt: 'mm:ss'},
        {id: 46, label: '[h]:mm:ss', fmt: '[h]:mm:ss'},
    ],
    Fraction: [
        {id: 12, label: '# ?/?', fmt: '# ?/?', example: '1 1/4'},
        {id: 13, label: '# ??/??', fmt: '# ??/??', example: '1 25/100'},
    ],
    Text: [{id: 49, label: 'Text (@)', fmt: '@', example: 'Treat as text'}],
    Custom: [],
}

const categories = Object.keys(presetCategories)

function guessCategoryByFmt(fmt?: string): string {
    if (!fmt) return 'General'
    for (const cat of categories) {
        if (cat === 'Custom') continue
        const arr = presetCategories[cat]
        if (arr.some((p) => p.fmt === fmt)) return cat
    }
    return fmt === 'General' ? 'General' : 'Custom'
}

export interface NumFmtPanelHandle {
    confirm: () => void
}

export const NumFmtPanel = forwardRef<NumFmtPanelHandle, NumFmtPanelProps>(
    ({value, onChange, width = '100%', height = 420, selectedData}, ref) => {
        const initCat = useMemo(() => guessCategoryByFmt(value), [value])
        const [category, setCategory] = useState<string>(initCat)
        const [fmt, setFmt] = useState<string>(value ?? 'General')

        const presets = presetCategories[category]

        const dataSvc = useInjection<DataServiceImpl>(TYPES.Data)

        useImperativeHandle(
            ref,
            () => ({
                confirm: () => {
                    // Prefer internal apply; fallback to external onConfirm
                    try {
                        const d = selectedData.data
                        if (d && d.ty === 'cellRange') {
                            const {startRow, endRow, startCol, endCol} = d.d
                            const sheetIdx = dataSvc.getCurrentSheetIdx()
                            const payloads: Payload[] = []
                            for (let r = startRow; r <= endRow; r++) {
                                for (let c = startCol; c <= endCol; c++) {
                                    payloads.push({
                                        type: 'setCellNumFmt',
                                        value: new SetCellNumFmtBuilder()
                                            .sheetIdx(sheetIdx)
                                            .row(r)
                                            .col(c)
                                            .numFmt(fmt)
                                            .build(),
                                    })
                                }
                            }
                            if (payloads.length) {
                                dataSvc.handleTransaction(
                                    new Transaction(payloads, true)
                                )
                            }
                        } else if (d && d.ty === 'line') {
                            const {start, end, type} = d.d
                            const sheetIdx = dataSvc.getCurrentSheetIdx()
                            const p: Payload = {
                                type: 'setLineNumFmt',
                                value: new SetLineNumFmtBuilder()
                                    .sheetIdx(sheetIdx)
                                    .from(start)
                                    .to(end)
                                    .row(type === 'row')
                                    .numFmt(fmt)
                                    .build(),
                            }
                            dataSvc.handleTransaction(
                                new Transaction([p], true)
                            )
                        }
                    } catch (e) {
                        // eslint-disable-next-line no-console
                        console.error(e)
                    }
                },
            }),
            [fmt, dataSvc, selectedData]
        )

        const handlePick = (nextFmt: string) => {
            setFmt(nextFmt)
            onChange?.(nextFmt)
        }

        const renderRight = () => {
            if (category === 'Custom') {
                return (
                    <Box
                        sx={{
                            p: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                        }}
                    >
                        <Typography variant="subtitle2">Sample</Typography>
                        <Box
                            sx={{
                                height: 40,
                                border: '1px solid #e0e0e0',
                                borderRadius: 1,
                                bgcolor: '#fafafa',
                                px: 1,
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            <Typography variant="body2">
                                {fmt || '—'}
                            </Typography>
                        </Box>
                        <Typography variant="subtitle2">
                            Type a custom format
                        </Typography>
                        <TextField
                            size="small"
                            value={fmt}
                            onChange={(e) => handlePick(e.target.value)}
                            placeholder="e.g. #,##0.00;[Red](#,##0.00)"
                            autoFocus
                        />
                        <Typography variant="caption" color="text.secondary">
                            Use Excel-like format codes. Examples: 0, 0.00,
                            #,##0, mm-dd-yy, h:mm, 0%.
                        </Typography>
                    </Box>
                )
            }
            return (
                <Box
                    sx={{
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                    }}
                >
                    <Typography variant="subtitle2">Sample</Typography>
                    <Box
                        sx={{
                            height: 40,
                            border: '1px solid #e0e0e0',
                            borderRadius: 1,
                            bgcolor: '#fafafa',
                            px: 1,
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        <Typography variant="body2">{fmt || '—'}</Typography>
                    </Box>
                    <Typography variant="subtitle2">Formats</Typography>
                    <RadioGroup
                        value={fmt}
                        onChange={(_, v) => handlePick(v)}
                        sx={{
                            maxHeight: (height as number) - 180,
                            overflowY: 'auto',
                        }}
                    >
                        {presets.map((p) => (
                            <FormControlLabel
                                key={p.id}
                                value={p.fmt}
                                control={<Radio size="small" />}
                                label={`${p.label}${
                                    p.example ? ` — ${p.example}` : ''
                                }`}
                            />
                        ))}
                    </RadioGroup>
                </Box>
            )
        }

        return (
            <Box
                sx={{
                    width,
                    height,
                    display: 'grid',
                    gridTemplateRows: 'auto 1fr auto',
                    // Fix left width and let right fill to avoid extra empty area
                    gridTemplateColumns: '220px 1fr',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    border: '1px solid #e0e0e0',
                    overflow: 'hidden',
                }}
            >
                <Box
                    sx={{
                        gridColumn: '1 / span 2',
                        px: 2,
                        py: 1.5,
                        borderBottom: '1px solid #eee',
                    }}
                >
                    <Typography variant="subtitle1">Number</Typography>
                </Box>
                <Box
                    sx={{
                        borderRight: '1px solid #eee',
                        overflowY: 'auto',
                        minHeight: 0,
                    }}
                >
                    <Typography variant="subtitle2" sx={{px: 2, pt: 2, pb: 1}}>
                        Category
                    </Typography>
                    <List disablePadding>
                        {categories.map((c) => (
                            <ListItemButton
                                key={c}
                                selected={c === category}
                                onClick={() => {
                                    setCategory(c)
                                    if (c !== 'Custom') {
                                        const first = presetCategories[c][0]
                                        if (first) handlePick(first.fmt)
                                    }
                                }}
                            >
                                {c}
                            </ListItemButton>
                        ))}
                    </List>
                </Box>
                <Box sx={{minHeight: 0, overflow: 'auto'}}>{renderRight()}</Box>
            </Box>
        )
    }
)

NumFmtPanel.displayName = 'NumFmtPanel'
export default NumFmtPanel
