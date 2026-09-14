import {useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {
    Box,
    Button,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    IconButton,
    InputLabel,
    Link,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import AddIcon from '@mui/icons-material/Add'
import type {BlockSchemaFieldEntry} from 'logisheets-engine'
import type {
    AggFunc,
    DimOrder,
    PivotColumnSpec,
    PivotFilter,
} from 'logisheets-core'

export interface PivotSpecChoice {
    refName: string
    rowDim: string
    colDim?: string
    measure: string
    func: AggFunc
    order?: DimOrder
    orderValues?: string[]
    filters?: PivotFilter[]
    extraColumns?: PivotColumnSpec[]
}

export interface PivotDialogProps {
    /** Ref name of the block being pivoted, for the default output name. */
    sourceName: string
    /** The source's fields, in column order. */
    fields: readonly BlockSchemaFieldEntry[]
    /**
     * Column index of the key field. Excluded from the default row dimension:
     * a key is unique by definition, so pivoting by it gives one row per
     * record — the source table again, which is the mistake this dialog's
     * hint warns about. Still selectable, in case the key really is a
     * category.
     */
    keyIdx?: number
    /**
     * An existing recipe to edit rather than a new one to create. Changes the
     * wording, and drops the name field: an edit keeps the block's ref name,
     * which is the reason to edit instead of rebuilding — every formula
     * pointing at it keeps working.
     */
    initial?: PivotSpecChoice
    /**
     * Switch to the summary form — the other kind of analysis. Absent when
     * editing: an existing pivot cannot become a summary row in place.
     */
    onSummary?: () => void
    onCancel: () => void
    onConfirm: (spec: PivotSpecChoice) => void
}

// `label` is a translation key resolved at render — this list is
// module-level and the language changes under it.
const FUNCS: ReadonlyArray<{value: AggFunc; label: string}> = [
    {value: 'SUM', label: 'block.agg.sum'},
    {value: 'AVERAGE', label: 'block.agg.average'},
    {value: 'COUNT', label: 'block.agg.count'},
    // Distinct from Count wherever a column has gaps: Count counts the
    // records in a group, this counts the ones where the value is there.
    {value: 'COUNTA', label: 'block.agg.countFilledShort'},
    {value: 'MIN', label: 'block.agg.min'},
    {value: 'MAX', label: 'block.agg.max'},
]

interface MeasureRow {
    name: string
    func: AggFunc
    measure: string
}

/**
 * Choose what to cross-tabulate.
 *
 * The four basic choices are always visible and the rest is folded away,
 * because most pivots are a plain cross-tab and a dialog that asks eight
 * questions to get one teaches people to stop reading it. What is behind the
 * fold is not optional polish, though — a filter changes which records are
 * counted at all, and a total column is the difference between a reader adding
 * up the quarters themselves and not.
 *
 * `measure` defaults to the first field the schema DECLARES a number, and the
 * row dimension skips the key: both defaults are only possible because those
 * declarations exist (see `design/block-field-semantics.md`).
 */
export const PivotDialog = ({
    sourceName,
    fields,
    keyIdx,
    initial,
    onSummary,
    onCancel,
    onConfirm,
}: PivotDialogProps) => {
    const {t} = useTranslation()
    const ordered = useMemo(
        () => [...fields].sort((a, b) => a.idx - b.idx),
        [fields]
    )
    const numbers = useMemo(
        () => ordered.filter((f) => f.fieldType?.kind === 'number'),
        [ordered]
    )
    // Where repeated values live: not a number (that is the measure), and not
    // the key (unique by definition).
    const dims = useMemo(
        () =>
            ordered.filter(
                (f) => f.fieldType?.kind !== 'number' && f.idx !== keyIdx
            ),
        [ordered, keyIdx]
    )

    const editing = initial !== undefined
    // A declared column with no measure of its own is a row total; one with a
    // measure is a second number. They are one concept on the wire and two in
    // the dialog, because they read as two different things.
    const total = initial?.extraColumns?.find((c) => c.measure === undefined)
    const seconds = (initial?.extraColumns ?? []).filter(
        (c) => c.measure !== undefined
    )

    const [rowDim, setRowDim] = useState(
        initial?.rowDim ?? dims[0]?.field ?? ''
    )
    const [colDim, setColDim] = useState(initial?.colDim ?? '')
    const [measure, setMeasure] = useState(
        initial?.measure ?? numbers[0]?.field ?? ordered[0]?.field ?? ''
    )
    const [func, setFunc] = useState<AggFunc>(initial?.func ?? 'SUM')
    const [refName, setRefName] = useState(
        initial?.refName ?? `${sourceName}_pivot`
    )

    // Opened already expanded when the recipe has anything in there to see.
    const [more, setMore] = useState(
        Boolean(total || seconds.length || initial?.filters?.length) ||
            initial?.order === 'custom'
    )
    const [rowTotal, setRowTotal] = useState(total?.name ?? '')
    const [order, setOrder] = useState<DimOrder>(initial?.order ?? 'ascending')
    const [orderText, setOrderText] = useState(
        (initial?.orderValues ?? []).join('\n')
    )
    const [filters, setFilters] = useState<PivotFilter[]>([
        ...(initial?.filters ?? []),
    ])
    const [measures, setMeasures] = useState<MeasureRow[]>(
        seconds.map((c) => ({
            name: c.name,
            func: (c.func ?? 'COUNT') as AggFunc,
            measure: c.measure ?? '',
        }))
    )

    const orderValues = orderText
        .split('\n')
        .map((v) => v.trim())
        .filter((v) => v !== '')

    const nameError = refName.trim() === ''
    const sameDim = colDim !== '' && colDim === rowDim
    const orderError = order === 'custom' && orderValues.length === 0
    const badFilter = filters.some(
        (f) => f.field === '' || f.criteria.trim() === ''
    )
    const badMeasure = measures.some(
        (m) => m.name.trim() === '' || m.measure === ''
    )
    const ready =
        !nameError &&
        rowDim !== '' &&
        measure !== '' &&
        !sameDim &&
        !orderError &&
        !badFilter &&
        !badMeasure

    const field = (f: BlockSchemaFieldEntry) => (
        <MenuItem key={f.field} value={f.field}>
            {f.field}
            {f.fieldType?.kind ? ` (${f.fieldType.kind})` : ''}
        </MenuItem>
    )

    const confirm = () =>
        onConfirm({
            refName: refName.trim(),
            rowDim,
            colDim: colDim === '' ? undefined : colDim,
            measure,
            func,
            order,
            orderValues: order === 'custom' ? orderValues : undefined,
            filters: filters.length ? filters : undefined,
            extraColumns: [
                // The total first, then the extra measures — the order a
                // reader expects, and the order the engine keeps on refresh.
                ...(rowTotal.trim() && colDim
                    ? [{name: rowTotal.trim(), colValue: null}]
                    : []),
                // An extra measure spans every column, like the total does.
                // Pinning one to a single column value is expressible in the
                // engine but not asked for here — it needs a fourth control on
                // a row that already has three.
                ...measures.map((m) => ({
                    name: m.name.trim(),
                    colValue: null,
                    func: m.func,
                    measure: m.measure,
                })),
            ].filter((c) => c.name !== ''),
        })

    return (
        <Dialog open onClose={onCancel} maxWidth="sm" fullWidth>
            <DialogTitle>
                {editing ? `Re-cut “${refName}”` : `Pivot “${sourceName}”`}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{mt: 1}}>
                    <FormControl fullWidth size="small">
                        <InputLabel>{t('block.pivot.rows')}</InputLabel>
                        <Select
                            label={t('block.pivot.rows')}
                            value={rowDim}
                            onChange={(e) => setRowDim(e.target.value)}
                        >
                            {ordered.map(field)}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                        <InputLabel>{t('block.pivot.columns')}</InputLabel>
                        <Select
                            label={t('block.pivot.columns')}
                            value={colDim}
                            onChange={(e) => setColDim(e.target.value)}
                        >
                            <MenuItem value="">
                                <em>{t('block.pivot.noColumns')}</em>
                            </MenuItem>
                            {ordered.map(field)}
                        </Select>
                    </FormControl>

                    <Stack direction="row" spacing={1}>
                        <FormControl fullWidth size="small">
                            <InputLabel>
                                {t('block.pivot.valueField')}
                            </InputLabel>
                            <Select
                                label={t('block.pivot.valueField')}
                                value={measure}
                                onChange={(e) => setMeasure(e.target.value)}
                            >
                                {ordered.map(field)}
                            </Select>
                        </FormControl>
                        <FormControl sx={{minWidth: 140}} size="small">
                            <InputLabel>{t('block.pivot.function')}</InputLabel>
                            <Select
                                label={t('block.pivot.function')}
                                value={func}
                                onChange={(e) =>
                                    setFunc(e.target.value as AggFunc)
                                }
                            >
                                {FUNCS.map((f) => (
                                    <MenuItem key={f.value} value={f.value}>
                                        {t(f.label)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>

                    {/* An edit keeps the name — that is the point of it:
                        every formula pointing at the block keeps working. */}
                    {!editing && (
                        <TextField
                            size="small"
                            label={t('block.pivot.newBlockName')}
                            value={refName}
                            error={nameError}
                            onChange={(e) => setRefName(e.target.value)}
                            helperText={t('block.pivot.newBlockNameHelp')}
                        />
                    )}

                    {sameDim && (
                        <Typography variant="caption" color="error">
                            {t('block.pivot.sameField')}
                        </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                        Rows and columns want fields whose values{' '}
                        <strong>repeat</strong> — region, quarter, status. Pick
                        one like id, different on every row, and all you get
                        back is the source table.
                    </Typography>

                    <Divider />
                    <Link
                        component="button"
                        type="button"
                        underline="hover"
                        variant="body2"
                        sx={{alignSelf: 'flex-start'}}
                        onClick={() => setMore((v) => !v)}
                    >
                        {more ? t('block.pivot.less') : t('block.pivot.more')}
                    </Link>

                    <Collapse in={more} unmountOnExit>
                        <Stack spacing={2}>
                            <TextField
                                size="small"
                                label={t('block.pivot.totalColumnName')}
                                value={rowTotal}
                                disabled={colDim === ''}
                                onChange={(e) => setRowTotal(e.target.value)}
                                helperText={
                                    colDim === ''
                                        ? t('block.pivot.totalRedundant')
                                        : t('block.pivot.totalColumnHelp', {
                                              dim: colDim,
                                          })
                                }
                            />

                            <Box>
                                <Typography variant="body2" gutterBottom>
                                    A second number
                                    <Typography
                                        component="span"
                                        variant="caption"
                                        color="text.secondary"
                                    >
                                        {' '}
                                        — another statistic on the same rows
                                    </Typography>
                                </Typography>
                                {measures.map((m, i) => (
                                    <Stack
                                        key={i}
                                        direction="row"
                                        spacing={1}
                                        sx={{mb: 1}}
                                    >
                                        <TextField
                                            size="small"
                                            label={t('block.pivot.columnName')}
                                            value={m.name}
                                            sx={{width: 110}}
                                            onChange={(e) =>
                                                setMeasures((ms) =>
                                                    ms.map((x, j) =>
                                                        j === i
                                                            ? {
                                                                  ...x,
                                                                  name: e.target
                                                                      .value,
                                                              }
                                                            : x
                                                    )
                                                )
                                            }
                                        />
                                        <FormControl
                                            size="small"
                                            sx={{minWidth: 110}}
                                        >
                                            <InputLabel>
                                                {t('block.pivot.function')}
                                            </InputLabel>
                                            <Select
                                                label={t(
                                                    'block.pivot.function'
                                                )}
                                                value={m.func}
                                                onChange={(e) =>
                                                    setMeasures((ms) =>
                                                        ms.map((x, j) =>
                                                            j === i
                                                                ? {
                                                                      ...x,
                                                                      func: e
                                                                          .target
                                                                          .value as AggFunc,
                                                                  }
                                                                : x
                                                        )
                                                    )
                                                }
                                            >
                                                {FUNCS.map((f) => (
                                                    <MenuItem
                                                        key={f.value}
                                                        value={f.value}
                                                    >
                                                        {f.value}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <FormControl size="small" fullWidth>
                                            <InputLabel>
                                                {t('block.pivot.field')}
                                            </InputLabel>
                                            <Select
                                                label={t('block.pivot.field')}
                                                value={m.measure}
                                                onChange={(e) =>
                                                    setMeasures((ms) =>
                                                        ms.map((x, j) =>
                                                            j === i
                                                                ? {
                                                                      ...x,
                                                                      measure:
                                                                          e
                                                                              .target
                                                                              .value,
                                                                  }
                                                                : x
                                                        )
                                                    )
                                                }
                                            >
                                                {ordered.map(field)}
                                            </Select>
                                        </FormControl>
                                        <IconButton
                                            size="small"
                                            onClick={() =>
                                                setMeasures((ms) =>
                                                    ms.filter((_, j) => j !== i)
                                                )
                                            }
                                        >
                                            <DeleteOutlinedIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                ))}
                                <Button
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={() =>
                                        setMeasures((ms) => [
                                            ...ms,
                                            {
                                                name: '',
                                                func: 'COUNT',
                                                measure,
                                            },
                                        ])
                                    }
                                >
                                    Add
                                </Button>
                            </Box>

                            <Box>
                                <Typography variant="body2" gutterBottom>
                                    Only count these records
                                    <Typography
                                        component="span"
                                        variant="caption"
                                        color="text.secondary"
                                    >
                                        {' '}
                                        — a record that fails enters no cell,
                                        and gets no row of its own
                                    </Typography>
                                </Typography>
                                {filters.map((f, i) => (
                                    <Stack
                                        key={i}
                                        direction="row"
                                        spacing={1}
                                        sx={{mb: 1}}
                                    >
                                        <FormControl size="small" fullWidth>
                                            <InputLabel>
                                                {t('block.pivot.field')}
                                            </InputLabel>
                                            <Select
                                                label={t('block.pivot.field')}
                                                value={f.field}
                                                onChange={(e) =>
                                                    setFilters((fs) =>
                                                        fs.map((x, j) =>
                                                            j === i
                                                                ? {
                                                                      ...x,
                                                                      field: e
                                                                          .target
                                                                          .value,
                                                                  }
                                                                : x
                                                        )
                                                    )
                                                }
                                            >
                                                {ordered.map(field)}
                                            </Select>
                                        </FormControl>
                                        <TextField
                                            size="small"
                                            label={t('block.pivot.condition')}
                                            value={f.criteria}
                                            fullWidth
                                            placeholder={String(
                                                t(
                                                    'block.pivot.conditionPlaceholder'
                                                )
                                            )}
                                            onChange={(e) =>
                                                setFilters((fs) =>
                                                    fs.map((x, j) =>
                                                        j === i
                                                            ? {
                                                                  ...x,
                                                                  criteria:
                                                                      e.target
                                                                          .value,
                                                              }
                                                            : x
                                                    )
                                                )
                                            }
                                        />
                                        <IconButton
                                            size="small"
                                            onClick={() =>
                                                setFilters((fs) =>
                                                    fs.filter((_, j) => j !== i)
                                                )
                                            }
                                        >
                                            <DeleteOutlinedIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                ))}
                                <Button
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={() =>
                                        setFilters((fs) => [
                                            ...fs,
                                            {
                                                field: dims[0]?.field ?? '',
                                                criteria: '',
                                            },
                                        ])
                                    }
                                >
                                    Add
                                </Button>
                            </Box>

                            <FormControl fullWidth size="small">
                                <InputLabel>
                                    {t('block.pivot.rowOrder')}
                                </InputLabel>
                                <Select
                                    label={t('block.pivot.rowOrder')}
                                    value={order}
                                    onChange={(e) =>
                                        setOrder(e.target.value as DimOrder)
                                    }
                                >
                                    <MenuItem value="ascending">
                                        {t('block.pivot.orderByValue')}
                                    </MenuItem>
                                    <MenuItem value="firstSeen">
                                        {t('block.pivot.orderFirstSeen')}
                                    </MenuItem>
                                    <MenuItem value="custom">
                                        {t('block.pivot.custom')}
                                    </MenuItem>
                                </Select>
                            </FormControl>
                            {order === 'custom' && (
                                <TextField
                                    size="small"
                                    label={t('block.pivot.orderList')}
                                    multiline
                                    minRows={3}
                                    value={orderText}
                                    error={orderError}
                                    onChange={(e) =>
                                        setOrderText(e.target.value)
                                    }
                                    helperText={t('block.pivot.orderListHelp')}
                                />
                            )}
                        </Stack>
                    </Collapse>
                </Stack>
            </DialogContent>
            <DialogActions>
                {onSummary && !editing && (
                    <Link
                        component="button"
                        type="button"
                        underline="hover"
                        variant="body2"
                        sx={{mr: 'auto', ml: 1}}
                        onClick={onSummary}
                    >
                        {t('block.pivot.analysisInstead')}
                    </Link>
                )}
                <Button onClick={onCancel}>{t('block.common.cancel')}</Button>
                <Button variant="contained" disabled={!ready} onClick={confirm}>
                    {editing
                        ? t('block.common.apply')
                        : t('block.common.create')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}
