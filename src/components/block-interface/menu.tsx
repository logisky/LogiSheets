import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import FunctionsIcon from '@mui/icons-material/Functions'
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined'
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined'
import styles from './block-interface.module.scss'
import React from 'react'
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
    /**
     * The block this one analyses, and the blocks that analyse it — resolved
     * to names, because that is what the user reads. Both sides are listed so
     * a pair is navigable from either end; see `design/block-analysis.md` §7.
     */
    readonly analyzes?: {blockId: number; name: string}
    readonly analyzedBy?: ReadonlyArray<{blockId: number; name: string}>
    /** Select and scroll to another block. Absent where no view is wired. */
    readonly onGoToBlock?: (blockId: number) => void
    /** Create the block that analyses this one. */
    readonly onCreateAnalysis: () => void
    /**
     * Delete this block. Owned by the parent because removing a block that
     * has analyses removes those too, and the parent holds the dialog that
     * says so.
     */
    readonly onDelete: () => void
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
    const {
        isOpen,
        setIsOpen,
        onModify,
        analyzes,
        analyzedBy = [],
        onGoToBlock,
        onCreateAnalysis,
        onDelete,
    } = props

    const items: Array<{
        label: React.ReactNode
        icon: React.ReactNode
        danger?: boolean
        onClick: () => void
    }> = [
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
            label: '创建分析块',
            icon: <FunctionsIcon />,
            onClick: onCreateAnalysis,
        },
    ]

    // Navigation both ways. The pair is deliberately not glued together — the
    // analysis does not follow the source when it moves — so being able to get
    // from one to the other is how the relationship stays workable.
    if (analyzes && onGoToBlock) {
        items.push({
            label: `源块：${analyzes.name}`,
            icon: <TableRowsOutlinedIcon />,
            onClick: () => onGoToBlock(analyzes.blockId),
        })
    }
    if (onGoToBlock) {
        for (const a of analyzedBy) {
            items.push({
                label: `分析块：${a.name}`,
                icon: <SummarizeOutlinedIcon />,
                onClick: () => onGoToBlock(a.blockId),
            })
        }
    }

    items.push({
        // Says up front that this is a two-block deletion. The dialog the
        // parent opens says which blocks.
        label:
            analyzedBy.length > 0
                ? `Delete（连带 ${analyzedBy.length} 个分析块）`
                : 'Delete',
        icon: <DeleteOutlinedIcon />,
        danger: true,
        onClick: onDelete,
    })

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
