import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import styles from './block-outliner.module.scss'
import React from 'react'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {CraftManager, DataService} from '@/core/data'
import {isErrorMessage, Transaction} from 'packages/web'

export interface MenuProps {
    readonly sheetId: number
    readonly blockId: number
    readonly isOpen: boolean
    readonly setIsOpen: (isOpen: boolean) => void
    readonly clickMousePosition: {x: number; y: number}
    readonly setDescriptorUrl: (url: string | undefined) => void
    readonly setError: (error: string | undefined) => void
    readonly setSuccessMessage: (message: string | undefined) => void
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
    const {sheetId, blockId, isOpen, setIsOpen} = props
    const CRAFT_MANAGER = useInjection<CraftManager>(TYPES.CraftManager)
    const DATA_MANAGER = useInjection<DataService>(TYPES.Data)
    const descriptor = CRAFT_MANAGER.getCraftDescriptor([sheetId, blockId])

    const setDescriptorUrl = props.setDescriptorUrl
    const setError = props.setError
    const setSuccessMessage = props.setSuccessMessage

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
                const result = await CRAFT_MANAGER.uploadCraftData([
                    sheetId,
                    blockId,
                ])
                if (result.isOk()) {
                    setError(undefined)
                    setDescriptorUrl(undefined)
                    setSuccessMessage('Data exported successfully')
                } else {
                    setError('Failed to upload data')
                    setDescriptorUrl(undefined)
                    setSuccessMessage(undefined)
                }
            },
        },
        {
            label: 'Import the data',
            onClick: async () => {
                const dlResult = await CRAFT_MANAGER.downloadCraftData([
                    sheetId,
                    blockId,
                ])
                if (!dlResult.isOk()) {
                    setError('Failed to import data')
                    setDescriptorUrl(undefined)
                    setSuccessMessage(undefined)
                    return
                }

                const payloads = dlResult._unsafeUnwrap()
                const result = await DATA_MANAGER.handleTransaction(
                    new Transaction(payloads, true)
                )
                if (isErrorMessage(result)) {
                    setError(result.msg)
                    setDescriptorUrl(undefined)
                    setSuccessMessage(undefined)
                    return
                }

                setError(undefined)
                setDescriptorUrl(undefined)
                setSuccessMessage('Data imported successfully')
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
                        onClick={(e) => {
                            e.stopPropagation()
                            item.onClick()
                            setIsOpen(false)
                        }}
                        onMouseDown={(e) => {
                            e.stopPropagation()
                        }}
                    >
                        {item.label}
                    </MenuItem>
                ))}
            </Menu>
        </>
    )
}
