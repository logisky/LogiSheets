/**
 * Data validation dialog (Excel's Data ▸ Data validation): pick what the
 * selected cells accept, what to say when a cell is selected, and what happens
 * when a value breaks the rule.
 *
 * OK sends one `setDataValidation` payload over the selection, which replaces
 * whatever rule its cells had (Excel keeps one per cell); "Any value" and Clear
 * all send no rule, clearing them. The engine marks violating cells through
 * their validation shadows; refusing a write is the host's job, at input time
 * (see `permissions/patch.ts`).
 */

import React from 'react'
import {useTranslation} from 'react-i18next'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import {isErrorMessage, toA1notation} from 'logisheets-engine'
import type {DataService, DataValidationSpec} from 'logisheets-engine'
import {CELL_IS_OPERATORS} from '@/components/conditional-formatting/rule-spec'
import {
    ALLOW_KINDS,
    DEFAULT_FORM,
    ERROR_STYLES,
    formToSpec,
    isTwoValued,
    specToForm,
    usesOperator,
    type DvForm,
} from './form'

export interface DataValidationDialogProps {
    dataSvc: DataService
    sheetIdx: number
    /** The selection the rule applies to, 0-based inclusive. */
    range: {startRow: number; startCol: number; endRow: number; endCol: number}
    onClose: () => void
}

function rangeLabel(r: DataValidationDialogProps['range']): string {
    const a = `${toA1notation(r.startCol)}${r.startRow + 1}`
    const b = `${toA1notation(r.endCol)}${r.endRow + 1}`
    return a === b ? a : `${a}:${b}`
}

const LABEL_WIDTH = 96

const Row: React.FC<{label: React.ReactNode; children: React.ReactNode}> = ({
    label,
    children,
}) => (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
        <Typography variant="body2" sx={{width: LABEL_WIDTH, flex: '0 0 auto'}}>
            {label}
        </Typography>
        {children}
    </Box>
)

export const DataValidationDialog: React.FC<DataValidationDialogProps> = ({
    dataSvc,
    sheetIdx,
    range,
    onClose,
}) => {
    const {t} = useTranslation()
    const [form, setForm] = React.useState<DvForm>(DEFAULT_FORM)
    /** Where the selection's current rule reaches beyond the selection. */
    const [existingSqref, setExistingSqref] = React.useState('')
    const [failure, setFailure] = React.useState<string | null>(null)

    // Prefill from the rule on the selection's top-left cell, like Excel.
    React.useEffect(() => {
        let live = true
        void dataSvc
            .getWorkbook()
            .getDataValidation({
                sheetIdx,
                row: range.startRow,
                col: range.startCol,
            })
            .then((info) => {
                if (!live || isErrorMessage(info) || !info) return
                setForm(specToForm(info.spec))
                setExistingSqref(info.sqref)
            })
        return () => {
            live = false
        }
    }, [dataSvc, sheetIdx, range.startRow, range.startCol])

    const set = <K extends keyof DvForm>(k: K, v: DvForm[K]) =>
        setForm((f) => ({...f, [k]: v}))

    const dispatch = async (rule: DataValidationSpec | null) => {
        const res = await dataSvc.handleTransaction({
            payloads: [
                {
                    type: 'setDataValidation',
                    value: {
                        sheetIdx,
                        startRow: range.startRow,
                        startCol: range.startCol,
                        endRow: range.endRow,
                        endCol: range.endCol,
                        // No rule clears the cells' validation.
                        rule: rule ?? undefined,
                    },
                },
            ],
            undoable: true,
            temp: false,
        })
        if (isErrorMessage(res)) {
            setFailure(res.msg)
            return
        }
        onClose()
    }

    const built = formToSpec(form)
    const formError = 'error' in built ? String(t(built.error)) : undefined
    const label = rangeLabel(range)
    const twoValued = isTwoValued(form.operator)
    const valueHint =
        form.allow === 'date'
            ? 'ui.dv.dateHint'
            : form.allow === 'time'
              ? 'ui.dv.timeHint'
              : 'ui.dv.valueHint'

    return (
        <Box sx={{width: 560, display: 'flex', flexDirection: 'column'}}>
            <Box sx={{px: 2, pt: 2, pb: 1}}>
                <Typography variant="h6">{t('ui.dv.title')}</Typography>
                <Typography variant="body2" color="text.secondary">
                    {t('ui.dv.appliesTo', {range: label})}
                </Typography>
                {existingSqref && existingSqref !== label && (
                    <Typography variant="body2" color="text.secondary">
                        {t('ui.dv.sharedRule', {sqref: existingSqref})}
                    </Typography>
                )}
            </Box>
            <Divider />
            <Box
                sx={{p: 2, display: 'flex', flexDirection: 'column', gap: 1.5}}
            >
                <Row label={t('ui.dv.allow')}>
                    <Select
                        size="small"
                        value={form.allow}
                        onChange={(e) =>
                            set('allow', e.target.value as DvForm['allow'])
                        }
                        sx={{minWidth: 200}}
                    >
                        {ALLOW_KINDS.map((k) => (
                            <MenuItem key={k} value={k}>
                                {t(`ui.dv.kind.${k}`)}
                            </MenuItem>
                        ))}
                    </Select>
                </Row>

                {usesOperator(form.allow) && (
                    <>
                        <Row label={t('ui.dv.data')}>
                            <Select
                                size="small"
                                value={form.operator}
                                onChange={(e) =>
                                    set('operator', e.target.value)
                                }
                                sx={{minWidth: 200}}
                            >
                                {CELL_IS_OPERATORS.map((o) => (
                                    <MenuItem key={o.value} value={o.value}>
                                        {t(o.label)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </Row>
                        <Row
                            label={
                                twoValued
                                    ? t('ui.dv.minimum')
                                    : t('ui.dv.value')
                            }
                        >
                            <TextField
                                size="small"
                                placeholder={String(t(valueHint))}
                                value={form.value1}
                                onChange={(e) => set('value1', e.target.value)}
                                sx={{flex: 1}}
                            />
                        </Row>
                        {twoValued && (
                            <Row label={t('ui.dv.maximum')}>
                                <TextField
                                    size="small"
                                    placeholder={String(t(valueHint))}
                                    value={form.value2}
                                    onChange={(e) =>
                                        set('value2', e.target.value)
                                    }
                                    sx={{flex: 1}}
                                />
                            </Row>
                        )}
                    </>
                )}

                {form.allow === 'list' && (
                    <Row label={t('ui.dv.source')}>
                        <TextField
                            size="small"
                            placeholder={String(t('ui.dv.sourceHint'))}
                            value={form.source}
                            onChange={(e) => set('source', e.target.value)}
                            sx={{flex: 1}}
                        />
                    </Row>
                )}

                {form.allow === 'custom' && (
                    <Row label={t('ui.dv.formula')}>
                        <TextField
                            size="small"
                            placeholder={String(
                                t('ui.dv.formulaHint', {
                                    cell: label.split(':')[0],
                                })
                            )}
                            value={form.formula}
                            onChange={(e) => set('formula', e.target.value)}
                            sx={{flex: 1}}
                        />
                    </Row>
                )}

                {form.allow !== 'any' && (
                    <Box sx={{display: 'flex', gap: 2, pl: `${LABEL_WIDTH}px`}}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    size="small"
                                    checked={form.allowBlank}
                                    onChange={(e) =>
                                        set('allowBlank', e.target.checked)
                                    }
                                />
                            }
                            label={t('ui.dv.ignoreBlank')}
                        />
                        {form.allow === 'list' && (
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={form.inCellDropdown}
                                        onChange={(e) =>
                                            set(
                                                'inCellDropdown',
                                                e.target.checked
                                            )
                                        }
                                    />
                                }
                                label={t('ui.dv.inCellDropdown')}
                            />
                        )}
                    </Box>
                )}

                {form.allow !== 'any' && (
                    <>
                        <Divider sx={{my: 0.5}} />
                        <Typography variant="subtitle2">
                            {t('ui.dv.inputMessage')}
                        </Typography>
                        <Row label={t('ui.dv.messageTitle')}>
                            <TextField
                                size="small"
                                value={form.promptTitle}
                                onChange={(e) =>
                                    set('promptTitle', e.target.value)
                                }
                                sx={{flex: 1}}
                            />
                        </Row>
                        <Row label={t('ui.dv.message')}>
                            <TextField
                                size="small"
                                value={form.prompt}
                                onChange={(e) => set('prompt', e.target.value)}
                                sx={{flex: 1}}
                            />
                        </Row>

                        <Divider sx={{my: 0.5}} />
                        <Typography variant="subtitle2">
                            {t('ui.dv.errorAlert')}
                        </Typography>
                        <Row label={t('ui.dv.style')}>
                            <Select
                                size="small"
                                value={form.errorStyle}
                                onChange={(e) =>
                                    set(
                                        'errorStyle',
                                        e.target.value as DvForm['errorStyle']
                                    )
                                }
                                sx={{minWidth: 200}}
                            >
                                {ERROR_STYLES.map((s) => (
                                    <MenuItem key={s} value={s}>
                                        {t(`ui.dv.errorStyle.${s}`)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </Row>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{pl: `${LABEL_WIDTH + 8}px`, mt: -1}}
                        >
                            {t(`ui.dv.errorStyleTip.${form.errorStyle}`)}
                        </Typography>
                        <Row label={t('ui.dv.messageTitle')}>
                            <TextField
                                size="small"
                                value={form.errorTitle}
                                onChange={(e) =>
                                    set('errorTitle', e.target.value)
                                }
                                sx={{flex: 1}}
                            />
                        </Row>
                        <Row label={t('ui.dv.message')}>
                            <TextField
                                size="small"
                                value={form.error}
                                onChange={(e) => set('error', e.target.value)}
                                sx={{flex: 1}}
                            />
                        </Row>
                    </>
                )}

                {(formError || failure) && (
                    <Typography variant="body2" color="error">
                        {failure ?? formError}
                    </Typography>
                )}
            </Box>
            <Divider />
            <Box sx={{display: 'flex', gap: 1, px: 2, py: 1.5}}>
                <Button size="small" onClick={() => void dispatch(null)}>
                    {t('ui.dv.clearAll')}
                </Button>
                <Box sx={{flex: 1}} />
                <Button size="small" onClick={onClose}>
                    {t('ui.common.cancel')}
                </Button>
                <Button
                    size="small"
                    variant="contained"
                    disabled={!!formError}
                    onClick={() => {
                        if ('spec' in built) void dispatch(built.spec)
                    }}
                >
                    {t('ui.common.ok')}
                </Button>
            </Box>
        </Box>
    )
}

export default DataValidationDialog
