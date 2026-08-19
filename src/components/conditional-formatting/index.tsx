/**
 * Conditional-formatting manager: lists the rules on the active sheet and hosts
 * the editor for adding or changing one.
 *
 * Rules of any type the engine can load are LISTED (with a summary and the range
 * they cover) so nothing in a loaded file is invisible, but only the four types
 * the editor has a form for can be changed — see `EDITABLE_TYPES`. Anything else
 * can still be deleted.
 */

import React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import type {CfRuleInfo} from 'logisheets-engine'
import {isErrorMessage} from 'logisheets-engine'
import type {DataService, Payload, Transaction} from 'logisheets-engine'
import {RuleEditor} from './rule-editor'
import {
    DEFAULT_FORM,
    describeRule,
    formToSpec,
    isEditableType,
    specToForm,
    type RuleForm,
} from './rule-spec'

export interface ConditionalFormattingDialogProps {
    dataSvc: DataService
    sheetIdx: number
    /** The selection a new rule applies to, 0-based inclusive. */
    range: {startRow: number; startCol: number; endRow: number; endCol: number}
    onClose: () => void
}

/** A small swatch showing what a rule's format looks like. */
const RulePreview: React.FC<{rule: CfRuleInfo}> = ({rule}) => {
    const style = rule.preview
    const fill = style?.fill
    const bg =
        fill && fill.type === 'patternFill'
            ? cssColor(fill.value.fgColor) ?? cssColor(fill.value.bgColor)
            : undefined
    const font = style?.font
    return (
        <Box
            sx={{
                width: 64,
                px: 1,
                py: 0.25,
                textAlign: 'center',
                border: '1px solid #ddd',
                borderRadius: 0.5,
                bgcolor: bg ?? 'transparent',
                color: cssColor(font?.color) ?? 'inherit',
                fontWeight: font?.bold ? 700 : 400,
                fontStyle: font?.italic ? 'italic' : 'normal',
                fontSize: 12,
                flex: '0 0 auto',
            }}
        >
            Aa
        </Box>
    )
}

/** A binding `Color` (0..255 components) as a CSS colour. */
function cssColor(c?: {
    red?: number
    green?: number
    blue?: number
}): string | undefined {
    if (
        !c ||
        c.red === undefined ||
        c.green === undefined ||
        c.blue === undefined
    )
        return undefined
    const to = (v: number) => Math.round(v).toString(16).padStart(2, '0')
    return `#${to(c.red)}${to(c.green)}${to(c.blue)}`
}

export const ConditionalFormattingDialog: React.FC<
    ConditionalFormattingDialogProps
> = ({dataSvc, sheetIdx, range, onClose}) => {
    const [rules, setRules] = React.useState<readonly CfRuleInfo[]>([])
    const [loading, setLoading] = React.useState(true)
    const [form, setForm] = React.useState<RuleForm | null>(null)
    /** Non-null when the editor is changing an existing rule. */
    const [editingId, setEditingId] = React.useState<number | null>(null)
    const [failure, setFailure] = React.useState<string | null>(null)

    const refresh = React.useCallback(async () => {
        const res = await dataSvc
            .getWorkbook()
            .getConditionalFormattingRules({sheetIdx})
        setLoading(false)
        if (isErrorMessage(res)) {
            setFailure(res.msg)
            return
        }
        setRules(res)
    }, [dataSvc, sheetIdx])

    React.useEffect(() => {
        void refresh()
    }, [refresh])

    const dispatch = React.useCallback(
        async (payloads: Payload[]) => {
            const tx: Transaction = {payloads, undoable: true, temp: false}
            const res = await dataSvc.handleTransaction(tx)
            if (isErrorMessage(res)) {
                setFailure(res.msg)
                return false
            }
            setFailure(null)
            await refresh()
            return true
        },
        [dataSvc, refresh]
    )

    const submit = async () => {
        if (!form) return
        const built = formToSpec(form)
        if ('error' in built) return
        const ok = await dispatch([
            editingId === null
                ? {
                      type: 'createConditionalFormattingRule',
                      value: {sheetIdx, ...range, rule: built.spec},
                  }
                : {
                      type: 'updateConditionalFormattingRule',
                      value: {sheetIdx, ruleId: editingId, rule: built.spec},
                  },
        ])
        if (ok) {
            setForm(null)
            setEditingId(null)
        }
    }

    const remove = (ruleId: number) =>
        dispatch([
            {
                type: 'deleteConditionalFormattingRule',
                value: {sheetIdx, ruleId},
            },
        ])

    const startEdit = (rule: CfRuleInfo) => {
        const seeded = specToForm(rule.spec)
        if (!seeded) return
        setForm(seeded)
        setEditingId(rule.ruleId)
    }

    const validation = form ? formToSpec(form) : undefined
    const formError =
        validation && 'error' in validation ? validation.error : undefined

    if (form) {
        return (
            <Box sx={{width: 620}}>
                <Typography variant="h6" sx={{px: 2, pt: 2}}>
                    {editingId === null
                        ? `New rule for ${rangeLabel(range)}`
                        : 'Edit rule'}
                </Typography>
                <RuleEditor
                    value={form}
                    onChange={setForm}
                    error={formError}
                    onSubmit={submit}
                    onCancel={() => {
                        setForm(null)
                        setEditingId(null)
                    }}
                    submitLabel={editingId === null ? 'Create' : 'Save'}
                />
                {failure && (
                    <Typography
                        variant="body2"
                        color="error"
                        sx={{px: 2, pb: 2}}
                    >
                        {failure}
                    </Typography>
                )}
            </Box>
        )
    }

    return (
        <Box sx={{width: 620, display: 'flex', flexDirection: 'column'}}>
            <Box
                sx={{
                    px: 2,
                    pt: 2,
                    pb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                }}
            >
                <Typography variant="h6" sx={{flex: 1}}>
                    Conditional formatting
                </Typography>
                <Button
                    size="small"
                    startIcon={<AddOutlinedIcon />}
                    onClick={() => {
                        setForm(DEFAULT_FORM)
                        setEditingId(null)
                    }}
                >
                    New rule
                </Button>
            </Box>
            <Divider />
            <Box sx={{maxHeight: 360, overflowY: 'auto', px: 2, py: 1}}>
                {loading && (
                    <Typography variant="body2" color="text.secondary">
                        Loading…
                    </Typography>
                )}
                {!loading && rules.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                        No rules on this sheet. “New rule” adds one for{' '}
                        {rangeLabel(range)}.
                    </Typography>
                )}
                {rules.map((r) => {
                    const editable = isEditableType(r.spec.ty)
                    return (
                        <Box
                            key={r.ruleId}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                                py: 0.75,
                                borderBottom: '1px solid #f0f0f0',
                            }}
                        >
                            <RulePreview rule={r} />
                            <Box sx={{flex: 1, minWidth: 0}}>
                                <Typography variant="body2" noWrap>
                                    {describeRule(r.spec)}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {r.range}
                                    {r.spec.stopIfTrue && ' · stop if true'}
                                </Typography>
                            </Box>
                            <Tooltip
                                title={
                                    editable
                                        ? 'Edit'
                                        : `No editor for ${r.spec.ty} rules yet — it can still be deleted`
                                }
                            >
                                <span>
                                    <IconButton
                                        size="small"
                                        disabled={!editable}
                                        onClick={() => startEdit(r)}
                                    >
                                        <EditOutlinedIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <IconButton
                                size="small"
                                onClick={() => void remove(r.ruleId)}
                            >
                                <DeleteOutlinedIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    )
                })}
            </Box>
            {failure && (
                <Typography variant="body2" color="error" sx={{px: 2}}>
                    {failure}
                </Typography>
            )}
            <Divider />
            <Box sx={{display: 'flex', justifyContent: 'flex-end', p: 1.5}}>
                <Button onClick={onClose}>Close</Button>
            </Box>
        </Box>
    )
}

/** `A1:C10`, or `A1` for a single cell. */
function rangeLabel(r: {
    startRow: number
    startCol: number
    endRow: number
    endCol: number
}): string {
    const a1 = (row: number, col: number) => `${colLetters(col)}${row + 1}`
    const start = a1(r.startRow, r.startCol)
    if (r.startRow === r.endRow && r.startCol === r.endCol) return start
    return `${start}:${a1(r.endRow, r.endCol)}`
}

function colLetters(col: number): string {
    let out = ''
    let c = col
    for (;;) {
        out = String.fromCharCode(65 + (c % 26)) + out
        if (c < 26) break
        c = Math.floor(c / 26) - 1
    }
    return out
}

export default ConditionalFormattingDialog
