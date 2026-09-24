/**
 * Name manager: the workbook's defined names, with go-to, edit and delete, and
 * a form that defines a new one (prefilled with the current selection).
 *
 * Saving an edited name whose NAME changed sends `renameName` first, so the
 * formulas that use it follow; the definition is then replaced with
 * `defineName`. The engine judges both — this dialog shows its reason when it
 * refuses.
 */

import React from 'react'
import {useTranslation} from 'react-i18next'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward'
import type {DataService, DefinedNameInfo} from 'logisheets-engine'
import {
    commitNamePayload,
    loadDefinedNames,
    parseNameRange,
    type NameRange,
} from '@/core/defined-names'

export interface NameManagerDialogProps {
    dataSvc: DataService
    sheetIdx: number
    /** What a new name refers to by default: the current selection. */
    initialRefersTo: string
    onGoTo: (range: NameRange) => void
    onClose: () => void
}

interface Form {
    /** The name being edited, or null for a new one. */
    original: string | null
    name: string
    refersTo: string
}

export const NameManagerDialog: React.FC<NameManagerDialogProps> = ({
    dataSvc,
    sheetIdx,
    initialRefersTo,
    onGoTo,
    onClose,
}) => {
    const {t} = useTranslation()
    const [names, setNames] = React.useState<readonly DefinedNameInfo[]>([])
    const [form, setForm] = React.useState<Form>({
        original: null,
        name: '',
        refersTo: initialRefersTo,
    })
    const [failure, setFailure] = React.useState<string | null>(null)

    const refresh = React.useCallback(async () => {
        setNames(await loadDefinedNames(dataSvc))
    }, [dataSvc])

    React.useEffect(() => {
        void refresh()
    }, [refresh])

    const resetForm = () =>
        setForm({original: null, name: '', refersTo: initialRefersTo})

    const save = async () => {
        const name = form.name.trim()
        if (!name || !form.refersTo.trim()) return
        let err: string | undefined
        if (form.original !== null && form.original !== name) {
            err = await commitNamePayload(dataSvc, {
                type: 'renameName',
                value: {oldName: form.original, newName: name},
            })
        }
        if (!err) {
            err = await commitNamePayload(dataSvc, {
                type: 'defineName',
                value: {name, formula: form.refersTo, sheetIdx},
            })
        }
        setFailure(err ?? null)
        await refresh()
        if (!err) resetForm()
    }

    const remove = async (name: string) => {
        const err = await commitNamePayload(dataSvc, {
            type: 'removeName',
            value: {name},
        })
        setFailure(err ?? null)
        if (form.original === name) resetForm()
        await refresh()
    }

    return (
        <Box sx={{width: 560, p: 2}}>
            <Typography variant="h6" sx={{mb: 1}}>
                {t('ui.nameManager.title')}
            </Typography>
            {names.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{py: 1}}>
                    {t('ui.nameManager.empty')}
                </Typography>
            ) : (
                <Box
                    sx={{
                        maxHeight: 260,
                        overflowY: 'auto',
                        border: '1px solid #e4e7ec',
                        borderRadius: 1,
                    }}
                >
                    {names.map((n) => {
                        const range = parseNameRange(n.formula)
                        return (
                            <Box
                                key={n.name}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    px: 1.5,
                                    py: 0.5,
                                    borderBottom: '1px solid #f2f4f7',
                                    bgcolor:
                                        form.original === n.name
                                            ? '#f5f8ff'
                                            : 'transparent',
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    sx={{fontWeight: 600, flex: '0 0 140px'}}
                                    noWrap
                                >
                                    {n.name}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{flex: 1, fontFamily: 'monospace'}}
                                    noWrap
                                    title={n.formula}
                                >
                                    {n.formula}
                                </Typography>
                                <Tooltip title={t('ui.nameManager.goTo')}>
                                    <span>
                                        <IconButton
                                            size="small"
                                            aria-label={String(
                                                t('ui.nameManager.goTo')
                                            )}
                                            disabled={!range}
                                            onClick={() =>
                                                range && onGoTo(range)
                                            }
                                        >
                                            <ArrowOutwardIcon fontSize="small" />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <Tooltip title={t('ui.nameManager.edit')}>
                                    <IconButton
                                        size="small"
                                        aria-label={String(
                                            t('ui.nameManager.edit')
                                        )}
                                        onClick={() => {
                                            setFailure(null)
                                            setForm({
                                                original: n.name,
                                                name: n.name,
                                                refersTo: n.formula,
                                            })
                                        }}
                                    >
                                        <EditOutlinedIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title={t('ui.common.delete')}>
                                    <IconButton
                                        size="small"
                                        aria-label={String(
                                            t('ui.common.delete')
                                        )}
                                        onClick={() => void remove(n.name)}
                                    >
                                        <DeleteOutlinedIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        )
                    })}
                </Box>
            )}

            <Typography variant="subtitle2" sx={{mt: 2, mb: 1}}>
                {form.original === null
                    ? t('ui.nameManager.newName')
                    : t('ui.nameManager.editName', {name: form.original})}
            </Typography>
            <Box sx={{display: 'flex', gap: 1}}>
                <TextField
                    size="small"
                    label={t('ui.nameManager.name')}
                    placeholder={String(t('ui.nameManager.namePlaceholder'))}
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
                    sx={{flex: '0 0 170px'}}
                    autoFocus
                />
                <TextField
                    size="small"
                    label={t('ui.nameManager.refersTo')}
                    value={form.refersTo}
                    onChange={(e) =>
                        setForm({...form, refersTo: e.target.value})
                    }
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') void save()
                    }}
                    sx={{flex: 1}}
                    slotProps={{htmlInput: {style: {fontFamily: 'monospace'}}}}
                />
            </Box>
            {failure && (
                <Typography
                    variant="body2"
                    color="error"
                    sx={{mt: 1, wordBreak: 'break-word'}}
                >
                    {failure}
                </Typography>
            )}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 1,
                    mt: 2,
                }}
            >
                {form.original !== null && (
                    <Button onClick={resetForm}>{t('ui.common.cancel')}</Button>
                )}
                <Button onClick={onClose}>{t('ui.common.close')}</Button>
                <Button
                    variant="contained"
                    disabled={!form.name.trim() || !form.refersTo.trim()}
                    onClick={() => void save()}
                >
                    {form.original === null
                        ? t('ui.common.create')
                        : t('ui.common.save')}
                </Button>
            </Box>
        </Box>
    )
}
