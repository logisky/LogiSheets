import {useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    Link,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import type {BlockSchemaFieldEntry} from 'logisheets-engine'
import type {AggFunc, AnalysisAggregate} from 'logisheets-core'

export interface AnalysisChoice {
    refName: string
    /** What goes in the key column, and the key the result is addressed by. */
    label: string
    aggregates: AnalysisAggregate[]
}

export interface AnalysisDialogProps {
    /** Ref name of the block being analysed, for the default output name. */
    sourceName: string
    /** The source's fields, in column order. */
    fields: readonly BlockSchemaFieldEntry[]
    /** An existing analysis to edit rather than a new one. */
    initial?: AnalysisChoice
    /** Switch to the cross-tab form — the other kind of analysis. */
    onCrossTab?: () => void
    onCancel: () => void
    onConfirm: (choice: AnalysisChoice) => void
}

/** `''` is "leave this column blank", which is most columns on most tables. */
// `label` is a translation key resolved at render — this list is
// module-level and the language changes under it. `''`/`—` is the one entry
// with nothing to translate.
const FUNCS: ReadonlyArray<{value: AggFunc | ''; label: string}> = [
    {value: '', label: ''},
    {value: 'SUM', label: 'block.agg.sum'},
    {value: 'AVERAGE', label: 'block.agg.average'},
    {value: 'COUNT', label: 'block.agg.countNumbers'},
    {value: 'COUNTA', label: 'block.agg.countFilled'},
    {value: 'MIN', label: 'block.agg.min'},
    {value: 'MAX', label: 'block.agg.max'},
]

/**
 * Choose what a summary row computes.
 *
 * A pivot is one kind of analysis and this is the other: one row, one number
 * per column, addressed by a single key. It used to have no dialog at all — a
 * menu click summed every number field and named the row "Total" — which is
 * the right guess often enough to be worth offering as the DEFAULT, and wrong
 * often enough that it should not have been the only option. Averaging a rate
 * column, counting a text column, leaving a column out: none of those were
 * expressible.
 *
 * The default is still SUM over every field the source declares a number, so
 * the common case is open-and-confirm.
 */
export const AnalysisDialog = ({
    sourceName,
    fields,
    initial,
    onCrossTab,
    onCancel,
    onConfirm,
}: AnalysisDialogProps) => {
    const {t} = useTranslation()
    const ordered = useMemo(
        () => [...fields].sort((a, b) => a.idx - b.idx),
        [fields]
    )
    const editing = initial !== undefined

    const [refName, setRefName] = useState(
        initial?.refName ?? `${sourceName}_analysis`
    )
    const [label, setLabel] = useState(initial?.label ?? 'Total')
    // Per field name, so reordering the source cannot shift a choice onto a
    // different column.
    const [chosen, setChosen] = useState<Record<string, AggFunc | ''>>(() => {
        const out: Record<string, AggFunc | ''> = {}
        for (const f of ordered) {
            const was = initial?.aggregates.find((a) => a.field === f.field)
            out[f.field] = was
                ? was.func
                : initial
                ? ''
                : f.fieldType?.kind === 'number'
                ? 'SUM'
                : ''
        }
        return out
    })

    const aggregates: AnalysisAggregate[] = ordered
        .filter((f) => chosen[f.field] !== '')
        .map((f) => ({field: f.field, func: chosen[f.field] as AggFunc}))

    const nameError = refName.trim() === ''
    const labelError = label.trim() === ''
    const ready = !nameError && !labelError && aggregates.length > 0

    return (
        <Dialog open onClose={onCancel} maxWidth="sm" fullWidth>
            <DialogTitle>
                {editing
                    ? `Summary of “${sourceName}”`
                    : `Summarise “${sourceName}”`}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{mt: 1}}>
                    <Typography variant="body2" color="text.secondary">
                        {t('block.analysis.intro')}
                    </Typography>

                    <Stack spacing={1.5}>
                        {ordered.map((f) => (
                            <FormControl key={f.field} fullWidth size="small">
                                <InputLabel>
                                    {f.field}
                                    {f.fieldType?.kind
                                        ? ` (${f.fieldType.kind})`
                                        : ''}
                                </InputLabel>
                                <Select
                                    label={
                                        f.field +
                                        (f.fieldType?.kind
                                            ? ` (${f.fieldType.kind})`
                                            : '')
                                    }
                                    value={chosen[f.field] ?? ''}
                                    onChange={(e) =>
                                        setChosen((c) => ({
                                            ...c,
                                            [f.field]: e.target.value as
                                                | AggFunc
                                                | '',
                                        }))
                                    }
                                >
                                    {FUNCS.map((fn) => (
                                        <MenuItem
                                            key={fn.value}
                                            value={fn.value}
                                        >
                                            {fn.label ? t(fn.label) : '—'}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ))}
                    </Stack>

                    <TextField
                        size="small"
                        label={t('block.analysis.rowLabel')}
                        value={label}
                        error={labelError}
                        onChange={(e) => setLabel(e.target.value)}
                        helperText={`How a formula reaches a result: BLOCKREF("${
                            refName || '<block>'
                        }", "${label || '<label>'}", "<field>")`}
                    />

                    {!editing && (
                        <TextField
                            size="small"
                            label={t('block.analysis.newBlockName')}
                            value={refName}
                            error={nameError}
                            onChange={(e) => setRefName(e.target.value)}
                        />
                    )}

                    {aggregates.length === 0 && (
                        <Typography variant="caption" color="error">
                            {t('block.analysis.nothingComputed')}
                        </Typography>
                    )}

                    {onCrossTab && !editing && (
                        <Link
                            component="button"
                            type="button"
                            underline="hover"
                            variant="body2"
                            sx={{alignSelf: 'flex-start'}}
                            onClick={onCrossTab}
                        >
                            {t('block.analysis.pivotInstead')}
                        </Link>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>{t('block.common.cancel')}</Button>
                <Button
                    variant="contained"
                    disabled={!ready}
                    onClick={() =>
                        onConfirm({
                            refName: refName.trim(),
                            label: label.trim(),
                            aggregates,
                        })
                    }
                >
                    {editing
                        ? t('block.common.apply')
                        : t('block.common.create')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}
