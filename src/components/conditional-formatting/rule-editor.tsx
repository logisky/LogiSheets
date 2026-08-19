/**
 * Form for one conditional-formatting rule.
 *
 * A single page rather than Excel's two-step (pick a type, then configure):
 * with four types the extra step buys nothing, and keeping the preview visible
 * while the format changes is worth more.
 */

import React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Popover from '@mui/material/Popover'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import {SketchPicker, type ColorResult} from 'react-color'
import {
    CELL_IS_OPERATORS,
    type EditableType,
    type RuleForm,
    operandCount,
} from './rule-spec'

const TYPE_LABELS: Record<EditableType, string> = {
    cellIs: 'Cell value',
    containsText: 'Text contains',
    colorScale: 'Colour scale',
    dataBar: 'Data bar',
}

/** A colour swatch that opens a picker. */
const ColorSwatch: React.FC<{
    value: string
    onChange: (css: string) => void
    size?: number
}> = ({value, onChange, size = 28}) => {
    const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
    return (
        <>
            <Box
                onClick={(e) => setAnchor(e.currentTarget)}
                sx={{
                    width: size,
                    height: size,
                    bgcolor: value,
                    border: '1px solid #ccc',
                    borderRadius: 1,
                    cursor: 'pointer',
                    flex: '0 0 auto',
                }}
            />
            <Popover
                open={!!anchor}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
            >
                <SketchPicker
                    color={value}
                    disableAlpha
                    onChangeComplete={(c: ColorResult) => onChange(c.hex)}
                />
            </Popover>
        </>
    )
}

export interface RuleEditorProps {
    value: RuleForm
    onChange: (v: RuleForm) => void
    /** Non-null when the form can't produce a valid rule yet. */
    error?: string
    onSubmit: () => void
    onCancel: () => void
    submitLabel: string
}

export const RuleEditor: React.FC<RuleEditorProps> = ({
    value,
    onChange,
    error,
    onSubmit,
    onCancel,
    submitLabel,
}) => {
    const set = <K extends keyof RuleForm>(k: K, v: RuleForm[K]) =>
        onChange({...value, [k]: v})

    const visual = value.ty === 'colorScale' || value.ty === 'dataBar'
    const twoOperands = operandCount(value.operator) === 2

    return (
        <Box sx={{p: 2, display: 'flex', flexDirection: 'column', gap: 2}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                <Typography variant="body2" sx={{width: 90}}>
                    Rule type
                </Typography>
                <Select
                    size="small"
                    value={value.ty}
                    onChange={(e) => set('ty', e.target.value as EditableType)}
                    sx={{minWidth: 200}}
                >
                    {(Object.keys(TYPE_LABELS) as EditableType[]).map((t) => (
                        <MenuItem key={t} value={t}>
                            {TYPE_LABELS[t]}
                        </MenuItem>
                    ))}
                </Select>
            </Box>

            {value.ty === 'cellIs' && (
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                    <Typography variant="body2" sx={{width: 90}}>
                        Condition
                    </Typography>
                    <Select
                        size="small"
                        value={value.operator}
                        onChange={(e) => set('operator', e.target.value)}
                        sx={{minWidth: 200}}
                    >
                        {CELL_IS_OPERATORS.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                                {o.label}
                            </MenuItem>
                        ))}
                    </Select>
                    <TextField
                        size="small"
                        placeholder="value"
                        value={value.operand1}
                        onChange={(e) => set('operand1', e.target.value)}
                        sx={{width: 110}}
                    />
                    {twoOperands && (
                        <>
                            <Typography variant="body2">and</Typography>
                            <TextField
                                size="small"
                                placeholder="value"
                                value={value.operand2}
                                onChange={(e) =>
                                    set('operand2', e.target.value)
                                }
                                sx={{width: 110}}
                            />
                        </>
                    )}
                </Box>
            )}

            {value.ty === 'containsText' && (
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                    <Typography variant="body2" sx={{width: 90}}>
                        Text
                    </Typography>
                    <TextField
                        size="small"
                        placeholder="text to look for"
                        value={value.text}
                        onChange={(e) => set('text', e.target.value)}
                        sx={{width: 260}}
                    />
                </Box>
            )}

            {value.ty === 'colorScale' && (
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                    <Typography variant="body2" sx={{width: 90}}>
                        Colours
                    </Typography>
                    {value.colors.map((c, i) => (
                        <ColorSwatch
                            key={i}
                            value={c}
                            onChange={(css) => {
                                const next = [...value.colors]
                                next[i] = css
                                set('colors', next)
                            }}
                        />
                    ))}
                    <Button
                        size="small"
                        onClick={() =>
                            set(
                                'colors',
                                value.colors.length === 2
                                    ? [
                                          value.colors[0],
                                          '#ffeb84',
                                          value.colors[1],
                                      ]
                                    : [value.colors[0], value.colors[2]]
                            )
                        }
                    >
                        {value.colors.length === 2 ? '3 colours' : '2 colours'}
                    </Button>
                </Box>
            )}

            {value.ty === 'dataBar' && (
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                    <Typography variant="body2" sx={{width: 90}}>
                        Bar colour
                    </Typography>
                    <ColorSwatch
                        value={value.colors[0]}
                        onChange={(css) =>
                            set('colors', [css, ...value.colors.slice(1)])
                        }
                    />
                </Box>
            )}

            {/* The visual types carry their own appearance, so a differential
                format would have nothing to apply. */}
            {!visual && (
                <>
                    <Typography variant="subtitle2">Format</Typography>
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    size="small"
                                    checked={value.useFill}
                                    onChange={(e) =>
                                        set('useFill', e.target.checked)
                                    }
                                />
                            }
                            label="Fill"
                        />
                        {value.useFill && (
                            <ColorSwatch
                                value={value.fillColor}
                                onChange={(css) => set('fillColor', css)}
                            />
                        )}
                        <FormControlLabel
                            control={
                                <Checkbox
                                    size="small"
                                    checked={value.useFontColor}
                                    onChange={(e) =>
                                        set('useFontColor', e.target.checked)
                                    }
                                />
                            }
                            label="Text colour"
                        />
                        {value.useFontColor && (
                            <ColorSwatch
                                value={value.fontColor}
                                onChange={(css) => set('fontColor', css)}
                            />
                        )}
                    </Box>
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    size="small"
                                    checked={value.bold}
                                    onChange={(e) =>
                                        set('bold', e.target.checked)
                                    }
                                />
                            }
                            label="Bold"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    size="small"
                                    checked={value.italic}
                                    onChange={(e) =>
                                        set('italic', e.target.checked)
                                    }
                                />
                            }
                            label="Italic"
                        />
                        <Box
                            sx={{
                                px: 2,
                                py: 0.5,
                                border: '1px solid #ddd',
                                borderRadius: 1,
                                bgcolor: value.useFill
                                    ? value.fillColor
                                    : 'transparent',
                                color: value.useFontColor
                                    ? value.fontColor
                                    : 'inherit',
                                fontWeight: value.bold ? 700 : 400,
                                fontStyle: value.italic ? 'italic' : 'normal',
                            }}
                        >
                            Preview
                        </Box>
                    </Box>
                </>
            )}

            <FormControlLabel
                control={
                    <Checkbox
                        size="small"
                        checked={value.stopIfTrue}
                        onChange={(e) => set('stopIfTrue', e.target.checked)}
                    />
                }
                label="Stop evaluating other rules when this one matches"
            />

            {error && (
                <Typography variant="body2" color="error">
                    {error}
                </Typography>
            )}

            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 1,
                    pt: 1,
                }}
            >
                <Button onClick={onCancel}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={onSubmit}
                    disabled={!!error}
                >
                    {submitLabel}
                </Button>
            </Box>
        </Box>
    )
}

export default RuleEditor
