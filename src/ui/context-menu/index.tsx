import Menu, {type MenuProps} from '@mui/material/Menu'
import MenuItem, {type MenuItemProps} from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import type {ReactNode} from 'react'
import type {SxProps, Theme} from '@mui/material/styles'

/**
 * Shared look for the app's right-click / context menus so they're all
 * consistent: rounded paper with a soft shadow and a hairline border, one fixed
 * width, uniform item metrics, and a single icon convention (an outlined MUI
 * icon in a fixed slot, red for destructive actions).
 *
 * Use `<ContextMenu>` in place of MUI `<Menu>` and `<ContextMenuItem>` for its
 * items. Both forward all MUI props and merge any caller `sx`, so per-menu
 * behaviour (positioning, hover submenus, transitions) is preserved.
 */

// Merge our base styles with a caller-supplied `sx` (object, array, or fn),
// normalising to the array form MUI accepts.
const mergeSx = (
    base: SxProps<Theme>,
    extra: SxProps<Theme> | undefined
): SxProps<Theme> => [
    ...(Array.isArray(base) ? base : [base]),
    ...(Array.isArray(extra) ? extra : extra != null ? [extra] : []),
]

const paperSx: SxProps<Theme> = {
    minWidth: 200,
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: '0 8px 28px rgba(0, 0, 0, 0.14)',
    overflow: 'hidden',
    '& .MuiDivider-root': {my: 0.5},
}

const listSx: SxProps<Theme> = {py: 0.5}

const itemSx: SxProps<Theme> = {
    minHeight: 34,
    px: 1.5,
    py: 0.625,
    gap: 1.25,
    fontSize: '0.8125rem',
    lineHeight: 1.5,
    '& .MuiListItemIcon-root': {
        minWidth: 0,
        color: 'text.secondary',
        '& > svg': {fontSize: '1.125rem'},
    },
    '& .MuiListItemText-primary': {
        fontSize: 'inherit',
        lineHeight: 'inherit',
    },
}

const dangerSx: SxProps<Theme> = {
    color: 'error.main',
    '& .MuiListItemIcon-root': {color: 'error.main'},
    '&:hover': {backgroundColor: 'rgba(211, 47, 47, 0.08)'},
}

/** MUI `<Menu>` pre-styled for context menus. Pass menu props as usual. */
export function ContextMenu({slotProps, MenuListProps, ...props}: MenuProps) {
    const paper = (slotProps?.paper ?? {}) as {sx?: SxProps<Theme>}
    return (
        <Menu
            disableScrollLock
            transformOrigin={{vertical: 'top', horizontal: 'left'}}
            {...props}
            slotProps={{
                ...slotProps,
                paper: {...paper, sx: mergeSx(paperSx, paper.sx)},
            }}
            MenuListProps={{
                autoFocusItem: false,
                ...MenuListProps,
                sx: mergeSx(listSx, MenuListProps?.sx),
            }}
        />
    )
}

export interface ContextMenuItemProps extends MenuItemProps {
    /**
     * Leading icon — an `@mui/icons-material` element. Provide one on every item
     * in a menu so their labels stay aligned; for a "no glyph" row (e.g. a
     * toggle's unselected state) pass a hidden icon rather than omitting it.
     */
    icon?: ReactNode
    /** Destructive action styling (red text + icon). */
    danger?: boolean
}

/** MUI `<MenuItem>` with a fixed icon slot + label, pre-styled to match. */
export function ContextMenuItem({
    icon,
    danger,
    children,
    sx,
    ...props
}: ContextMenuItemProps) {
    return (
        <MenuItem
            {...props}
            sx={mergeSx(danger ? mergeSx(itemSx, dangerSx) : itemSx, sx)}
        >
            {icon !== undefined && <ListItemIcon>{icon}</ListItemIcon>}
            <ListItemText>{children}</ListItemText>
        </MenuItem>
    )
}
