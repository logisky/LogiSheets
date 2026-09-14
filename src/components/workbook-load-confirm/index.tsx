import React, {useEffect, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
} from '@mui/material'
import {useEngine} from '@/core/engine/provider'

/**
 * Guards every workbook load behind an overwrite confirmation.
 *
 * Loading a workbook discards the one currently open. We register a
 * `beforeLoad` gate on the engine (the single choke point every load path —
 * the toolbar file-open, and any craft-initiated load — funnels through); when
 * a load is requested the gate opens this dialog and resolves to the user's
 * choice. Declining aborts the load with no side effects.
 *
 * Mounted once at the app root so the gate is always registered.
 */
export const WorkbookLoadConfirm: React.FC = () => {
    const {t} = useTranslation()
    const engine = useEngine()
    const [open, setOpen] = useState(false)
    // Resolver for the in-flight beforeLoad promise. `null` when idle.
    const resolveRef = useRef<((proceed: boolean) => void) | null>(null)

    useEffect(() => {
        engine.setBeforeLoadWorkbook(
            () =>
                new Promise<boolean>((resolve) => {
                    // Defensive: if a prior request is somehow still pending,
                    // cancel it before taking over the dialog.
                    resolveRef.current?.(false)
                    resolveRef.current = resolve
                    setOpen(true)
                })
        )
        return () => engine.setBeforeLoadWorkbook(undefined)
    }, [engine])

    const settle = (proceed: boolean) => {
        setOpen(false)
        resolveRef.current?.(proceed)
        resolveRef.current = null
    }

    return (
        <Dialog open={open} onClose={() => settle(false)}>
            <DialogTitle>{t('ui.dialog.replaceTitle')}</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {t('ui.dialog.replaceBody')}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => settle(false)}>
                    {t('ui.common.cancel')}
                </Button>
                <Button onClick={() => settle(true)} color="primary" autoFocus>
                    {t('ui.dialog.replace')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}
