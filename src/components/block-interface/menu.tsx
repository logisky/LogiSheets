import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import styles from './block-interface.module.scss'
import React from 'react'
import {useOps} from '@/core/engine/provider'
import {ContextMenu, ContextMenuItem} from '@/ui/context-menu'

export interface MenuProps {
    readonly sheetId: number
    /** The block's own sheet index — use this, not the active-view pointer,
     *  so block actions target the right sheet in any view. */
    readonly sheetIdx: number
    readonly blockId: number
    readonly isOpen: boolean
    readonly setIsOpen: (isOpen: boolean) => void
    readonly clickMousePosition: {x: number; y: number}
    readonly setDescriptorUrl: (url: string | undefined) => void
    readonly setError: (error: string | undefined) => void
    readonly setSuccessMessage: (message: string | undefined) => void
    /** Open the block composer in edit mode over this block. Owned by the
     *  parent so it survives this menu unmounting on select. */
    readonly onModify: () => void
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
    const {sheetIdx, blockId, isOpen, setIsOpen, onModify} = props
    const ops = useOps()

    const items = [
        {
            label: 'Modify',
            icon: <EditOutlinedIcon />,
            // Delegate to the parent — selecting an item closes (unmounts) this
            // menu, so the composer it opens must live in the parent.
            onClick: () => {
                onModify()
            },
        },
        {
            label: 'Delete',
            icon: <DeleteOutlinedIcon />,
            danger: true,
            onClick: () => {
                ops.removeBlock(sheetIdx, blockId)
            },
        },
    ]

    return (
        <ContextMenu
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
                <ContextMenuItem
                    key={idx}
                    icon={item.icon}
                    danger={item.danger}
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
                </ContextMenuItem>
            ))}
        </ContextMenu>
    )
}
