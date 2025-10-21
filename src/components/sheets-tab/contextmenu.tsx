import {
    SheetRenameBuilder,
    DeleteSheetBuilder,
    Transaction,
    Payload,
    isErrorMessage,
} from 'logisheets-web'
import {useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {DataServiceImpl as DataService} from '@/core/data'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {useToast} from '@/ui/notification/useToast'
import styles from './sheets-tab.module.scss'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
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
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
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

    // Compute a compact height and center it vertically within the tab
    const desiredHeight = Math.max(20, Math.min(28, tabHeight - 4))
    const inlineTop = tabTop + Math.max(0, (tabHeight - desiredHeight) / 2)

    return (
        <>
            <Menu
                open={isOpen}
                onClose={() => setIsOpen(false)}
                // Avoid MUI focus management interfering with our inline input
                disableAutoFocus
                disableEnforceFocus
                disableRestoreFocus
                anchorReference="anchorPosition"
                anchorPosition={{top: top - 140, left}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
                disableScrollLock={true}
                MenuListProps={{autoFocusItem: false}}
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
                    },
                }}
            >
                <MenuItem onClick={openRename}>✏️ Rename</MenuItem>
                <Divider />
                <MenuItem onClick={deleteSheet}>🗑️ Delete</MenuItem>
            </Menu>
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
