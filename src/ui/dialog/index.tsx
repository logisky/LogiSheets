import MuiDialog, {type DialogProps} from '@mui/material/Dialog'
import MuiDialogActions, {
    type DialogActionsProps,
} from '@mui/material/DialogActions'
import MuiDialogContent, {
    type DialogContentProps,
} from '@mui/material/DialogContent'
import MuiDialogContentText, {
    type DialogContentTextProps,
} from '@mui/material/DialogContentText'
import MuiDialogTitle, {type DialogTitleProps} from '@mui/material/DialogTitle'
import type {SxProps, Theme} from '@mui/material/styles'

/**
 * The app's one dialog look — use these instead of MUI's `Dialog*`
 * components (ESLint enforces it outside this file).
 *
 * The look is the "soft, rounded, hairline" family the context menus
 * (`@/ui/context-menu`) and the block composer already use: rounded paper with
 * a hairline border and a soft shadow, a medium-weight title, and buttons and
 * tabs in sentence case rather than MUI's default capitals. There is no MUI
 * theme in this app, so without a shared component every dialog drifted back
 * to stock MUI.
 *
 * Drop-in: same names and props as MUI's. Caller `sx` (and `PaperProps.sx`)
 * is merged AFTER the shared styles, so a dialog can still set its own size
 * or padding.
 */

// Merge base styles with a caller-supplied `sx` (object, array, or fn),
// normalising to the array form MUI accepts.
const mergeSx = (
    base: SxProps<Theme>,
    extra: SxProps<Theme> | undefined
): SxProps<Theme> => [
    ...(Array.isArray(base) ? base : [base]),
    ...(Array.isArray(extra) ? extra : extra != null ? [extra] : []),
]

const paperSx: SxProps<Theme> = {
    borderRadius: 3,
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.18)',
    // Every button and tab inside a dialog, whoever renders it.
    '& .MuiButton-root': {
        textTransform: 'none',
        borderRadius: 1.5,
        fontWeight: 600,
    },
    '& .MuiButton-contained, & .MuiButton-contained:hover': {
        boxShadow: 'none',
    },
    '& .MuiTabs-root': {minHeight: 40},
    '& .MuiTab-root': {
        textTransform: 'none',
        fontWeight: 600,
        minHeight: 40,
        px: 1.5,
    },
}

// Paper styles go through `PaperProps` (no caller here uses
// `slotProps.paper`): MUI 6 reads one or the other, not a merge of both.
export function Dialog({PaperProps, ...props}: DialogProps) {
    return (
        <MuiDialog
            {...props}
            PaperProps={{
                ...PaperProps,
                sx: mergeSx(paperSx, PaperProps?.sx),
            }}
        />
    )
}

const titleSx: SxProps<Theme> = {
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.5,
    px: 3,
    pt: 2.5,
    pb: 1,
}

export function DialogTitle({sx, ...props}: DialogTitleProps) {
    return <MuiDialogTitle {...props} sx={mergeSx(titleSx, sx)} />
}

export function DialogContent(props: DialogContentProps) {
    return <MuiDialogContent {...props} />
}

const contentTextSx: SxProps<Theme> = {fontSize: '0.875rem'}

export function DialogContentText({sx, ...props}: DialogContentTextProps) {
    return <MuiDialogContentText {...props} sx={mergeSx(contentTextSx, sx)} />
}

const actionsSx: SxProps<Theme> = {px: 3, pb: 2.5, pt: 1, gap: 1}

export function DialogActions({sx, ...props}: DialogActionsProps) {
    return <MuiDialogActions {...props} sx={mergeSx(actionsSx, sx)} />
}
