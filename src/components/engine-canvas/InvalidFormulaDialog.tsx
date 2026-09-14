import React from 'react'
import {useTranslation} from 'react-i18next'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
} from '@mui/material'

export interface InvalidFormulaDialogProps {
    open: boolean
    onClose: () => void
}

export const InvalidFormulaDialog: React.FC<InvalidFormulaDialogProps> = ({
    open,
    onClose,
}) => {
    const {t} = useTranslation()
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>{t('ui.dialog.invalidFormulaTitle')}</DialogTitle>
            <DialogContent>{t('ui.dialog.invalidFormulaBody')}</DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="primary" autoFocus>
                    OK
                </Button>
            </DialogActions>
        </Dialog>
    )
}
