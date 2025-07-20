import Modal from '@mui/material/Modal'
import styles from './block-outliner.module.scss'
import React from 'react'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {CraftManager} from '@/core/data'

export interface ContextMenuProps {
    readonly sheetId: number
    readonly blockId: number
    readonly isOpen: boolean
    readonly setIsOpen: (isOpen: boolean) => void
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

export const ContextMenuComponent = (props: ContextMenuProps) => {
    const {sheetId, blockId, isOpen, setIsOpen} = props
    const CRAFT_MANAGER = useInjection<CraftManager>(TYPES.CraftManager)
    const descriptor = CRAFT_MANAGER.getCraftDescriptor([sheetId, blockId])
    if (!descriptor) {
        throw Error('Failed to get craft descriptor')
    }
    const items = [
        {
            label: 'Modify',
            onClick: () => {
                setIsOpen(false)
                // todo
            },
        },
        {
            label: 'Delete',
            onClick: () => {
                setIsOpen(false)
                // todo
            },
        },
        {
            label: 'Export the descriptor',
            onClick: async () => {
                await CRAFT_MANAGER.exportCraftDescriptor([sheetId, blockId])
                setIsOpen(false)
            },
        },
        {
            label: 'Export the data',
            onClick: async () => {
                await CRAFT_MANAGER.exportDataArea([sheetId, blockId])
                setIsOpen(false)
            },
        },
        {
            label: 'Import the data',
            onClick: () => {
                setIsOpen(false)
                // todo
            },
        },
    ]

    return (
        <Modal
            open={isOpen}
            onClose={() => setIsOpen(false)}
            aria-labelledby="block-outliner-context-menu"
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <div className={styles['context-menu']} tabIndex={-1}>
                <ClickableList items={items} />
            </div>
        </Modal>
    )
}
