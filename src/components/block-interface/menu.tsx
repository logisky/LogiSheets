import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import FunctionsIcon from '@mui/icons-material/Functions'
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined'
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined'
import PivotTableChartOutlinedIcon from '@mui/icons-material/PivotTableChartOutlined'
import RefreshIcon from '@mui/icons-material/Refresh'
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
    /**
     * Open the analysis dialog over this block. A summary row and a pivot are
     * two kinds of the same thing, so they are one item rather than two: the
     * dialog asks which, and each form links to the other. Absent when the
     * block cannot be analysed (no schema).
     */
    readonly onAnalyse?: () => void
    /**
     * Re-open the pivot dialog over this pivot's own recipe. Pivots only.
     * Distinct from a refresh: a refresh re-derives the SHAPE from an
     * unchanged recipe, this changes the recipe itself.
     */
    readonly onEditPivot?: () => void
    /**
     * Re-open the summary form over this analysis block's own declarations.
     * Analysis blocks that are NOT pivots — a pivot has its own item, because
     * changing a recipe changes the shape as well as the number.
     */
    readonly onEditAnalysis?: () => void
    /** Bring this pivot's rows and columns back in line. Pivots only. */
    readonly onRefreshPivot?: () => void
    /**
     * How many groups the source has that this pivot does not show. Shown on
     * the refresh item, because "refresh" alone gives a user no reason to.
     */
    readonly pivotStaleCount?: number
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
        onAnalyse,
        onEditAnalysis,
        onEditPivot,
        onRefreshPivot,
        pivotStaleCount,
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
    ]

    if (onAnalyse) {
        items.push({
            label: 'Analyse…',
            icon: <FunctionsIcon />,
            onClick: onAnalyse,
        })
    }
    if (onEditAnalysis) {
        items.push({
            label: 'Edit summary…',
            icon: <FunctionsIcon />,
            onClick: onEditAnalysis,
        })
    }
    if (onEditPivot) {
        // Editing rather than rebuilding keeps the block's ref name, so every
        // formula pointing at it keeps working — and it is the only way to fix
        // a recipe that has stopped resolving, which a refresh cannot.
        items.push({
            label: 'Edit pivot…',
            icon: <PivotTableChartOutlinedIcon />,
            onClick: onEditPivot,
        })
    }
    if (onRefreshPivot) {
        // A pivot's NUMBERS are live; only its rows and columns fall behind.
        // The count is the whole point of the label: "refresh" on its own
        // gives a user no reason to, and a pivot that is behind looks
        // perfectly fine — every number in it is correct.
        items.push({
            label: pivotStaleCount
                ? `Refresh pivot (${pivotStaleCount} group${
                      pivotStaleCount === 1 ? '' : 's'
                  } missing)`
                : 'Refresh pivot',
            icon: <RefreshIcon />,
            danger: !!pivotStaleCount,
            onClick: onRefreshPivot,
        })
    }

    // Navigation both ways. The pair is deliberately not glued together — the
    // analysis does not follow the source when it moves — so being able to get
    // from one to the other is how the relationship stays workable.
    if (analyzes && onGoToBlock) {
        items.push({
            label: `Source block: ${analyzes.name}`,
            icon: <TableRowsOutlinedIcon />,
            onClick: () => onGoToBlock(analyzes.blockId),
        })
    }
    if (onGoToBlock) {
        for (const a of analyzedBy) {
            items.push({
                label: `Analysis block: ${a.name}`,
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
                ? `Delete (with ${analyzedBy.length} analysis block${
                      analyzedBy.length === 1 ? '' : 's'
                  })`
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
