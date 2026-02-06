import React from 'react'
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
}) => (
    <Dialog open={open} onClose={onClose}>
        <DialogTitle>Invalid Formula</DialogTitle>
        <DialogContent>
            The entered formula is invalid. Please check and try again.
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} color="primary" autoFocus>
                OK
            </Button>
        </DialogActions>
    </Dialog>
)
