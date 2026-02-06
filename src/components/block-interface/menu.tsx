import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import styles from './block-interface.module.scss'
import React from 'react'
import {useEngine} from '@/core/engine/provider'
import {RemoveBlockBuilder, Transaction} from 'packages/web'

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
    const engine = useEngine()
    const DATA_SERVICE = engine.getDataService()

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
                DATA_SERVICE.handleTransaction(
                    new Transaction(
                        [
                            {
                                type: 'removeBlock',
                                value: new RemoveBlockBuilder()
                                    .sheetIdx(DATA_SERVICE.getCurrentSheetIdx())
                                    .id(blockId)
                                    .build(),
                            },
                        ],
                        true
                    )
                )
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
