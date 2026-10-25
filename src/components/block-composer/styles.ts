import type {SxProps, Theme} from '@mui/material/styles'

/**
 * Shared "soft, rounded, hairline" look for the block composer, aligned with
 * the app's context menus (see `src/ui/context-menu`) and dialogs
 * (`src/ui/dialog`, which owns the dialog paper): a soft drop shadow,
 * `divider` hairlines, rounded corners, restrained monochrome buttons, and
 * small uppercase `text.secondary` section labels instead of heavy bold heads.
 */

/**
 * Dialog paper: just the composer's size. The rounded, hairline, soft-shadow
 * paper itself comes from the shared `@/ui/dialog`.
 */
export const dialogPaperSx: SxProps<Theme> = {
    height: '80vh',
    overflow: 'hidden',
}

/** Restrained button: no shouty uppercase, gently rounded. */
export const buttonSx: SxProps<Theme> = {
    textTransform: 'none',
    borderRadius: 1.5,
    fontWeight: 600,
}

/** Primary CTA (Save): filled but flat — no elevation, matching the flat menu. */
export const primaryButtonSx: SxProps<Theme> = {
    ...(buttonSx as object),
    boxShadow: 'none',
    '&:hover': {boxShadow: 'none'},
}

/** Outlined section card: rounded, hairline, no elevation. */
export const cardSx: SxProps<Theme> = {
    borderRadius: 2,
    borderColor: 'divider',
    boxShadow: 'none',
}

/** Small uppercase label used for panel/section headings. */
export const sectionLabelSx: SxProps<Theme> = {
    display: 'block',
    color: 'text.secondary',
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    lineHeight: 1.4,
}
