import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import styles from './block-outliner.module.scss'
import React from 'react'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {CraftManager} from '@/core/data'
import {ok} from '@/core/error'

export interface MenuProps {
    readonly sheetId: number
    readonly blockId: number
    readonly isOpen: boolean
    readonly setIsOpen: (isOpen: boolean) => void
    readonly clickMousePosition: {x: number; y: number}
    readonly setDescriptorUrl: (url: string | undefined) => void
    readonly setError: (error: string | undefined) => void
}

export interface ClickableListProps {
    items: {label: React.ReactNode; onClick: () => void}[]
    style?: React.CSSProperties
    className?: string
}

export const ClickableList = ({
    items,
    style,
    className,
}: ClickableListProps) => {
    return (
        <div className={className} style={style}>
            {items.map((item, idx) => (
                <div
                    key={idx}
                    className={styles['context-menu-item']}
                    onClick={item.onClick}
                    tabIndex={0}
                    style={{cursor: 'pointer'}}
                >
                    {item.label}
                </div>
            ))}
        </div>
    )
}

export const MenuComponent = (props: MenuProps) => {
    const [snackbarOpen, setSnackbarOpen] = React.useState(false)
    const [snackbarUrl, setSnackbarUrl] = React.useState<string | undefined>(
        undefined
    )
    const [snackbarError, setSnackbarError] = React.useState<
        string | undefined
    >(undefined)
    const {sheetId, blockId, isOpen, setIsOpen} = props
    const CRAFT_MANAGER = useInjection<CraftManager>(TYPES.CraftManager)
    const descriptor = CRAFT_MANAGER.getCraftDescriptor([sheetId, blockId])

    const setDescriptorUrl = props.setDescriptorUrl
    const setError = props.setError

    if (descriptor.isErr()) {
        throw Error('Failed to get craft descriptor')
    }
    const items = [
        {
            label: 'Modify',
            onClick: () => {
                // todo
            },
        },
        {
            label: 'Delete',
            onClick: () => {
                // todo
            },
        },
        {
            label: 'Export the descriptor',
            onClick: async () => {
                const url = await CRAFT_MANAGER.uploadCraftDescriptor([
                    sheetId,
                    blockId,
                ])
                if (url.isOk()) {
                    setDescriptorUrl(url._unsafeUnwrap())
                    setError(undefined)
                } else {
                    setDescriptorUrl(undefined)
                    setError('Failed to generate export URL')
                }
            },
        },
        {
            label: 'Export the data',
            onClick: async () => {
                await CRAFT_MANAGER.exportDataArea([sheetId, blockId])
            },
        },
        {
            label: 'Import the data',
            onClick: () => {
                // todo
            },
        },
    ]

    return (
        <>
            <Menu
                open={isOpen}
                onClose={() => setIsOpen(false)}
                anchorReference="anchorPosition"
                anchorPosition={{
                    top: props.clickMousePosition.y,
                    left: props.clickMousePosition.x,
                }}
                disableRestoreFocus={true}
            >
                {items.map((item, idx) => (
                    <MenuItem
                        key={idx}
                        onClick={() => {
                            item.onClick()
                            setIsOpen(false)
                        }}
                    >
                        {item.label}
                    </MenuItem>
                ))}
            </Menu>
            <Snackbar
                open={snackbarOpen}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{vertical: 'top', horizontal: 'center'}}
                sx={{
                    zIndex: 10,
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    position: 'fixed',
                    '& .MuiSnackbarContent-root': {
                        minHeight: 60,
                        minWidth: 400,
                        maxWidth: 400,
                        maxHeight: 100,
                        boxSizing: 'border-box',
                        wordBreak: 'break-all',
                        alignItems: 'center',
                    },
                }}
            >
                {snackbarError || snackbarUrl ? (
                    <Alert
                        severity={snackbarError ? 'error' : 'success'}
                        onClose={() => setSnackbarOpen(false)}
                        action={
                            snackbarUrl ? (
                                <Button
                                    color="inherit"
                                    size="small"
                                    onClick={() => {
                                        navigator.clipboard.writeText(
                                            snackbarUrl!
                                        )
                                    }}
                                >
                                    Copy
                                </Button>
                            ) : undefined
                        }
                    >
                        {snackbarError ? (
                            <span>{snackbarError}</span>
                        ) : (
                            <span>
                                URL:{' '}
                                <a
                                    href={snackbarUrl!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {snackbarUrl}
                                </a>
                            </span>
                        )}
                    </Alert>
                ) : undefined}
            </Snackbar>
        </>
    )
}
