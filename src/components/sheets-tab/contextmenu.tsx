import {
    SheetRenameBuilder,
    DeleteSheetBuilder,
    Transaction,
    Payload,
    isErrorMessage,
    SetSheetColorBuilder,
} from 'logisheets-engine'
import {useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {useEngine} from '@/core/engine/provider'
import {useToast} from '@/ui/notification/useToast'
import {StandardColor} from '@/core/standable'
import styles from './sheets-tab.module.scss'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Popover from '@mui/material/Popover'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import {ZINDEX_UI} from '../const'

export interface ContextMenuProps {
    readonly index: number
    readonly sheetnames: readonly string[]
    readonly isOpen: boolean
    readonly setIsOpen: (isOpen: boolean) => void
    readonly left: number
    readonly top: number
    readonly tabLeft: number
    readonly tabTop: number
    readonly tabWidth: number
    readonly tabHeight: number
}

export const ContextMenuComponent = (props: ContextMenuProps) => {
    const {
        index,
        sheetnames: sheetNames,
        setIsOpen,
        top,
        left,
        isOpen,
        tabLeft,
        tabTop,
        tabWidth,
        tabHeight,
    } = props
    const [renameIsOpen, setRenameIsOpen] = useState(false)
    const [pendingRename, setPendingRename] = useState(false)
    const modalRootRef = useRef<HTMLElement | null>(null)
    const bodyTabindexRef = useRef(false)
    const oldName = sheetNames[index] || ''
    const [newName, setNewName] = useState(oldName)
    const engine = useEngine()
    const DATA_SERVICE = engine.getDataService()
    const toast = useToast()

    const openRename = () => {
        // Blur any focused element inside the Menu to avoid aria-hidden + focused descendent
        const active = document.activeElement as HTMLElement | null
        active?.blur?.()
        // Prefill with current name
        setNewName(sheetNames[index] || '')
        // Ensure there is always a safe, focusable target outside the modal tree
        if (!document.body.hasAttribute('tabindex')) {
            document.body.setAttribute('tabindex', '-1')
            bodyTabindexRef.current = true
        }
        document.body.focus?.()
        // Temporarily inert the MUI modal root to fully prevent focus
        modalRootRef.current = document.querySelector(
            '.MuiModal-root'
        ) as HTMLElement | null
        modalRootRef.current?.setAttribute('inert', '')
        // Close the menu first; wait for transition end to open input
        setPendingRename(true)
        setIsOpen(false)
    }

    // Keep input value synced if rename dialog is open and index/sheet names change
    useEffect(() => {
        if (renameIsOpen) {
            setNewName(sheetNames[index] || '')
        }
    }, [renameIsOpen, index, sheetNames])

    const rename = () => {
        if (!newName) return
        if (newName === oldName) return
        const sheetRename: Payload = {
            type: 'sheetRename',
            value: new SheetRenameBuilder()
                .oldName(oldName)
                .newName(newName)
                .build(),
        }
        DATA_SERVICE.handleTransaction(
            new Transaction([sheetRename], true)
        ).then((v) => {
            if (isErrorMessage(v)) return
            setIsOpen(false)
        })
    }

    const deleteSheet = () => {
        if (sheetNames.length === 1) {
            toast.toast.error(
                'Deletion failed: A spreadsheet must have at least one sheet.'
            )
            return
        }
        const payload: Payload = {
            type: 'deleteSheet',
            value: new DeleteSheetBuilder().idx(index).build(),
        }
        DATA_SERVICE.handleTransaction(new Transaction([payload], true)).then(
            (v) => {
                if (isErrorMessage(v)) return
                setIsOpen(false)
            }
        )
    }

    // Hover color picker: single anchor position state
    const [colorAnchorPos, setColorAnchorPos] = useState<{
        top: number
        left: number
    } | null>(null)
    const colorCloseTimer = useRef<number | null>(null)
    const COLOR_SWATCHES = [
        '#d32f2f',
        '#c2185b',
        '#7b1fa2',
        '#512da8',
        '#303f9f',
        '#1976d2',
        '#0288d1',
        '#00796b',
        '#388e3c',
        '#689f38',
        '#fbc02d',
        '#ffa000',
        '#f57c00',
        '#6d4c41',
        '#455a64',
        '',
    ]

    const openColorPopover = (el: HTMLElement) => {
        if (colorCloseTimer.current) {
            window.clearTimeout(colorCloseTimer.current)
            colorCloseTimer.current = null
        }
        const rect = el.getBoundingClientRect()
        setColorAnchorPos({
            top: rect.top + rect.height / 2,
            left: rect.right + 4, // 4px offset to avoid covering MenuItem
        })
    }

    const closeColorPopover = () => {
        if (colorCloseTimer.current) {
            window.clearTimeout(colorCloseTimer.current)
            colorCloseTimer.current = null
        }
        setColorAnchorPos(null)
    }

    const scheduleCloseColorPopover = () => {
        if (colorCloseTimer.current) {
            window.clearTimeout(colorCloseTimer.current)
        }
        colorCloseTimer.current = window.setTimeout(() => {
            setColorAnchorPos(null)
            colorCloseTimer.current = null
        }, 200)
    }

    const cancelCloseColorPopover = () => {
        if (colorCloseTimer.current) {
            window.clearTimeout(colorCloseTimer.current)
            colorCloseTimer.current = null
        }
    }

    const hexToRgb = (hex: string): {r: number; g: number; b: number} => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result
            ? {
                  r: parseInt(result[1], 16),
                  g: parseInt(result[2], 16),
                  b: parseInt(result[3], 16),
              }
            : {r: 0, g: 0, b: 0}
    }

    const setSheetColor = (color: string) => {
        let payload: Payload
        if (color.length === 0) {
            payload = {
                type: 'setSheetColor',
                value: new SetSheetColorBuilder().idx(index).color('').build(),
            }
        } else {
            const {r, g, b} = hexToRgb(color)
            const standardColor = StandardColor.from(r, g, b, 1)
            payload = {
                type: 'setSheetColor',
                value: new SetSheetColorBuilder()
                    .idx(index)
                    .color(standardColor.argb())
                    .build(),
            }
        }
        closeColorPopover()
        DATA_SERVICE.handleTransaction(new Transaction([payload], true)).then(
            (v) => {
                if (isErrorMessage(v)) return
                setIsOpen(false)
            }
        )
    }

    // Compute a compact height and center it vertically within the tab
    const desiredHeight = Math.max(20, Math.min(28, tabHeight - 4))
    const inlineTop = tabTop + Math.max(0, (tabHeight - desiredHeight) / 2)

    return (
        <>
            <Menu
                open={isOpen}
                onClose={() => {
                    setIsOpen(false)
                    closeColorPopover()
                }}
                // Avoid MUI focus management interfering with our inline input
                disableAutoFocus
                disableEnforceFocus
                disableRestoreFocus
                anchorReference="anchorPosition"
                anchorPosition={{top: top - 140, left}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
                disableScrollLock={true}
                MenuListProps={{
                    autoFocusItem: false,
                    onMouseLeave: scheduleCloseColorPopover,
                }}
                TransitionProps={{
                    onExited: () => {
                        // Clean up inert and body tabindex after Menu fully unmounts
                        if (modalRootRef.current) {
                            modalRootRef.current.removeAttribute('inert')
                            modalRootRef.current = null
                        }
                        if (bodyTabindexRef.current) {
                            document.body.removeAttribute('tabindex')
                            bodyTabindexRef.current = false
                        }
                        if (pendingRename) {
                            setPendingRename(false)
                            // Next microtask to ensure unmounted
                            Promise.resolve().then(() => setRenameIsOpen(true))
                        }
                    },
                }}
                slotProps={{
                    paper: {
                        sx: {minWidth: 200, p: 0.5},
                        onMouseEnter: cancelCloseColorPopover,
                    },
                }}
            >
                <MenuItem onClick={openRename} onMouseEnter={closeColorPopover}>
                    ✏️ Rename
                </MenuItem>
                <MenuItem
                    onMouseEnter={(e) => {
                        openColorPopover(e.currentTarget as HTMLElement)
                    }}
                >
                    🎨 Color
                </MenuItem>
                <Divider />
                <MenuItem
                    onClick={deleteSheet}
                    onMouseEnter={closeColorPopover}
                >
                    🗑️ Delete
                </MenuItem>
            </Menu>
            <Popover
                open={colorAnchorPos !== null}
                anchorReference="anchorPosition"
                anchorPosition={colorAnchorPos ?? {top: 0, left: 0}}
                onClose={closeColorPopover}
                anchorOrigin={{vertical: 'center', horizontal: 'right'}}
                transformOrigin={{vertical: 'center', horizontal: 'left'}}
                transitionDuration={0}
                disableAutoFocus
                disableEnforceFocus
                disableRestoreFocus
                sx={{
                    pointerEvents: 'none',
                }}
                slotProps={{
                    paper: {
                        onMouseEnter: cancelCloseColorPopover,
                        onMouseLeave: scheduleCloseColorPopover,
                        sx: {
                            p: 1,
                            pointerEvents: 'auto',
                        },
                    },
                }}
            >
                <Box
                    onMouseEnter={cancelCloseColorPopover}
                    onMouseLeave={scheduleCloseColorPopover}
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(8, 16px)',
                        gap: 0.5,
                    }}
                >
                    {COLOR_SWATCHES.map((c) => (
                        <Box
                            key={c}
                            role="button"
                            aria-label={`color ${c}`}
                            tabIndex={0}
                            onMouseDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setSheetColor(c)
                            }}
                            onClick={() => setSheetColor(c)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    setSheetColor(c)
                                }
                            }}
                            sx={{
                                width: 16,
                                height: 16,
                                borderRadius: 0.5,
                                border: '1px solid rgba(0,0,0,0.2)',
                                backgroundColor: c,
                                cursor: 'pointer',
                            }}
                        />
                    ))}
                </Box>
            </Popover>
            {renameIsOpen &&
                createPortal(
                    <div
                        className={styles['rename-inline']}
                        tabIndex={-1}
                        style={{
                            position: 'fixed',
                            top: inlineTop,
                            left: tabLeft,
                            width: tabWidth,
                            height: desiredHeight,
                            display: 'flex',
                            alignItems: 'center',
                            zIndex: ZINDEX_UI,
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.stopPropagation()
                                e.preventDefault()
                                setRenameIsOpen(false)
                                rename()
                            } else if (e.key === 'Escape') {
                                e.stopPropagation()
                                e.preventDefault()
                                setRenameIsOpen(false)
                            }
                        }}
                    >
                        <input
                            autoFocus
                            className={styles['rename-input']}
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onBlur={() => {
                                setRenameIsOpen(false)
                                rename()
                            }}
                        />
                    </div>,
                    document.body
                )}
        </>
    )
}
