/**
 * Hyperlinks in the app: the insert/edit dialog, and following a link —
 * Ctrl/⌘+click on the canvas (the engine's `followHyperlink` event) or the
 * right-click menu's "Open link".
 */

import {useCallback, useEffect, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import type {DataService, Payload, SelectedData} from 'logisheets-engine'
import {isErrorMessage} from 'logisheets-engine'
import type {HyperlinkInfo} from 'logisheets-web'
import {
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
} from '@/ui/dialog'
import {useToast} from '@/ui/notification/useToast'
import {useHostWindow} from '@/ui/popout-window'
import {followHyperlink, getHyperlink, openableUrl} from '@/core/hyperlinks'

/** Excel's built-in Hyperlink cell style: blue, single underline. */
const LINK_COLOR = 'FF0563C1'

export interface HyperlinkTarget {
    sheetIdx: number
    row: number
    col: number
}

/**
 * Follow the link in a cell, telling the user when nothing could be opened.
 * The returned function is stable across renders.
 */
export function useFollowHyperlink(opts: {
    dataSvc: DataService
    setActiveSheet: (idx: number) => void
    setSelection: (d: SelectedData) => void
}): (target: HyperlinkTarget) => Promise<void> {
    const {t} = useTranslation()
    const {toast} = useToast()
    const hostWindow = useHostWindow()
    const optsRef = useRef(opts)
    optsRef.current = opts
    return useCallback(
        async ({sheetIdx, row, col}: HyperlinkTarget) => {
            const {dataSvc, setActiveSheet, setSelection} = optsRef.current
            const r = await followHyperlink(
                {dataSvc, sheetIdx, hostWindow, setActiveSheet, setSelection},
                row,
                col
            ).catch(() => ({kind: 'failed' as const}))
            if (r.kind === 'blocked')
                toast(String(t('ui.hyperlink.blocked', {url: r.url})), {
                    type: 'warning',
                })
            else if (r.kind === 'missing')
                toast(
                    String(t('ui.hyperlink.missing', {location: r.location})),
                    {type: 'info'}
                )
            else if (r.kind === 'failed')
                toast(String(t('ui.hyperlink.openFailed')), {type: 'error'})
        },
        [t, toast, hostWindow]
    )
}

/**
 * Subscribe to a view's `followHyperlink` event (the engine for the main
 * view, a session for the others) and follow the link.
 */
export function useFollowHyperlinkEvent(
    source: {
        on(type: 'followHyperlink', cb: (e: HyperlinkTarget) => void): void
        off(type: 'followHyperlink', cb: (e: HyperlinkTarget) => void): void
    } | null,
    follow: (target: HyperlinkTarget) => Promise<void>
): void {
    useEffect(() => {
        if (!source) return
        const cb = (e: HyperlinkTarget) => void follow(e)
        source.on('followHyperlink', cb)
        return () => source.off('followHyperlink', cb)
    }, [source, follow])
}

/**
 * Open the link dialog on Ctrl/⌘+K: the view's `insertHyperlink` event names
 * the active cell. Render `<HyperlinkDialog target={…}>` with the returned
 * target.
 */
export function useInsertHyperlinkShortcut(
    source: {
        on(type: 'insertHyperlink', cb: (e: HyperlinkTarget) => void): void
        off(type: 'insertHyperlink', cb: (e: HyperlinkTarget) => void): void
    } | null
): [HyperlinkTarget | null, (t: HyperlinkTarget | null) => void] {
    const [target, setTarget] = useState<HyperlinkTarget | null>(null)
    useEffect(() => {
        if (!source) return
        const cb = (e: HyperlinkTarget) => setTarget(e)
        source.on('insertHyperlink', cb)
        return () => source.off('insertHyperlink', cb)
    }, [source])
    return [target, setTarget]
}

type Kind = 'web' | 'place'

export interface HyperlinkDialogProps {
    dataSvc: DataService
    /** The cell to link; `null` keeps the dialog closed. */
    target: HyperlinkTarget | null
    onClose: () => void
}

/** Insert, edit or remove the link stored on one cell. */
export function HyperlinkDialog({
    dataSvc,
    target,
    onClose,
}: HyperlinkDialogProps) {
    const {t} = useTranslation()
    const [existing, setExisting] = useState<HyperlinkInfo | null>(null)
    const [kind, setKind] = useState<Kind>('web')
    const [address, setAddress] = useState('')
    const [display, setDisplay] = useState('')
    const [tooltip, setTooltip] = useState('')
    const [cellText, setCellText] = useState('')
    const [hasFormula, setHasFormula] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!target) return
        let live = true
        const {sheetIdx, row, col} = target
        void Promise.all([
            getHyperlink(dataSvc, sheetIdx, row, col),
            dataSvc.getCellInfo(sheetIdx, row, col),
        ]).then(([link, cell]) => {
            if (!live) return
            const text = cell && !isErrorMessage(cell) ? cell.getText() : ''
            const formula =
                cell && !isErrorMessage(cell) ? cell.getFormula() !== '' : false
            setExisting(link)
            setKind(link?.location && !link.url ? 'place' : 'web')
            setAddress(link?.url ?? link?.location ?? '')
            setTooltip(link?.tooltip ?? '')
            setCellText(text)
            setDisplay(text)
            setHasFormula(formula)
            setError(null)
        })
        return () => {
            live = false
        }
    }, [dataSvc, target])

    if (!target) return null
    const {sheetIdx, row, col} = target
    const fromFormula = existing?.fromFormula === true

    const commit = async (payloads: Payload[]) => {
        const r = await dataSvc.handleTransaction({
            payloads,
            undoable: true,
            temp: false,
        })
        if (isErrorMessage(r)) {
            setError(r.msg)
            return
        }
        onClose()
    }

    const save = () => {
        const raw = address.trim()
        if (!raw) return
        let url: string | undefined
        let location: string | undefined
        if (kind === 'web') {
            // `example.com` means the web, as in Excel; anything with another
            // scheme is refused here and again when followed.
            url =
                openableUrl(raw) ??
                (/^[a-z][\w+.-]*:/i.test(raw) ? undefined : `https://${raw}`)
            if (!url) {
                setError(String(t('ui.hyperlink.unsupportedScheme')))
                return
            }
        } else {
            location = raw.replace(/^#/, '')
        }
        const payloads: Payload[] = [
            {
                type: 'setHyperlink',
                value: {
                    sheetIdx,
                    row,
                    col,
                    url,
                    location,
                    tooltip: tooltip.trim() || undefined,
                },
            },
        ]
        // The cell shows the display text — or the address, when the cell
        // was empty and no text was given. A formula cell keeps its formula.
        const shown = display.trim() === '' && cellText === '' ? raw : display
        if (!hasFormula && shown !== cellText) {
            payloads.push({
                type: 'cellInput',
                value: {sheetIdx, row, col, content: shown},
            })
        }
        if (!existing) {
            payloads.push({
                type: 'cellStyleUpdate',
                value: {
                    sheetIdx,
                    row,
                    col,
                    ty: {setFontColor: LINK_COLOR, setFontUnderline: 'single'},
                },
            })
        }
        void commit(payloads)
    }

    const remove = () =>
        void commit([
            {type: 'removeHyperlink', value: {sheetIdx, row, col}},
            {
                type: 'cellStyleUpdate',
                value: {
                    sheetIdx,
                    row,
                    col,
                    ty: {setFontColor: 'FF000000', setFontUnderline: 'none'},
                },
            },
        ])

    return (
        <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>
                {existing
                    ? t('ui.hyperlink.editTitle')
                    : t('ui.hyperlink.insertTitle')}
            </DialogTitle>
            <DialogContent>
                {fromFormula ? (
                    <DialogContentText>
                        {t('ui.hyperlink.fromFormula')}
                    </DialogContentText>
                ) : (
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            pt: 1,
                        }}
                    >
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={kind}
                            onChange={(_, v: Kind | null) => v && setKind(v)}
                        >
                            <ToggleButton
                                value="web"
                                sx={{textTransform: 'none'}}
                            >
                                {t('ui.hyperlink.web')}
                            </ToggleButton>
                            <ToggleButton
                                value="place"
                                sx={{textTransform: 'none'}}
                            >
                                {t('ui.hyperlink.place')}
                            </ToggleButton>
                        </ToggleButtonGroup>
                        <TextField
                            autoFocus
                            size="small"
                            label={
                                kind === 'web'
                                    ? t('ui.hyperlink.address')
                                    : t('ui.hyperlink.location')
                            }
                            placeholder={
                                kind === 'web'
                                    ? t('ui.hyperlink.addressPlaceholder')
                                    : t('ui.hyperlink.locationPlaceholder')
                            }
                            value={address}
                            onChange={(e) => {
                                setAddress(e.target.value)
                                setError(null)
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') save()
                            }}
                            error={!!error}
                            helperText={error ?? ' '}
                        />
                        <TextField
                            size="small"
                            label={t('ui.hyperlink.display')}
                            value={display}
                            disabled={hasFormula}
                            helperText={
                                hasFormula
                                    ? t('ui.hyperlink.displayFormula')
                                    : ' '
                            }
                            onChange={(e) => setDisplay(e.target.value)}
                        />
                        <TextField
                            size="small"
                            label={t('ui.hyperlink.tooltip')}
                            value={tooltip}
                            onChange={(e) => setTooltip(e.target.value)}
                        />
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                {existing && !fromFormula && (
                    <Button color="error" onClick={remove} sx={{mr: 'auto'}}>
                        {t('ui.hyperlink.remove')}
                    </Button>
                )}
                <Button onClick={onClose}>
                    {fromFormula ? t('ui.common.close') : t('ui.common.cancel')}
                </Button>
                {!fromFormula && (
                    <Button
                        variant="contained"
                        disableElevation
                        disabled={!address.trim()}
                        onClick={save}
                    >
                        {t('ui.common.save')}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    )
}
