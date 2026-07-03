import {useCallback, useEffect, useMemo, useState} from 'react'
import {createPortal} from 'react-dom'
import {observer} from 'mobx-react-lite'
import type {Grid} from 'logisheets-engine'
import type {Author, Comment, CommentMention, EditPayload} from 'logisheets-web'
import {useEngine, useDataService, useWorkbook} from '@/core/engine/provider'
import {globalStore} from '@/store'
import {rectForCell} from './cell-rect'
import {CommentThread} from './comment-thread'
import styles from './comment-layer.module.scss'

export interface CommentLayerProps {
    grid: Grid
    /** This view's active sheet index. */
    activeSheet: number
    /** Viewport coords of this view's canvas top-left (to portal the panel). */
    canvasStartX: number
    canvasStartY: number
}

interface OpenCell {
    row: number
    col: number
}

function newGuid(): string {
    return `{${crypto.randomUUID()}}`
}

/**
 * Renders cell comment indicators over a single view and, on click, a threaded
 * comment panel (list + composer with `@mentions`). Gated by the View-tab
 * "Show comments" toggle. Reads via the worker-backed `getComments` query and
 * mutates via `handleTransaction` (comment payloads); author identity comes
 * from the injected `AuthorService`.
 */
export const CommentLayer = observer(function CommentLayer({
    grid,
    activeSheet,
    canvasStartX,
    canvasStartY,
}: CommentLayerProps) {
    const engine = useEngine()
    const workbook = useWorkbook()
    const dataSvc = useDataService()
    const [comments, setComments] = useState<readonly Comment[]>([])
    const [open, setOpen] = useState<OpenCell | null>(null)

    const refresh = useCallback(async () => {
        try {
            const r = await workbook.getComments({sheetIdx: activeSheet})
            setComments(Array.isArray(r) ? r : [])
        } catch {
            setComments([])
        }
    }, [workbook, activeSheet])

    // Re-fetch on sheet switch and whenever the workbook signals a change
    // (covers loads, undo/redo, and our own comment mutations).
    useEffect(() => {
        refresh()
        const cb = () => {
            refresh()
        }
        engine.on('cellChange', cb)
        return () => engine.off('cellChange', cb)
    }, [engine, refresh])

    // Right-click "Add comment" raises a request; open the composer for it.
    const pending = globalStore.pendingCommentCell
    useEffect(() => {
        if (!pending || pending.sheetIdx !== activeSheet) return
        setOpen({row: pending.row, col: pending.col})
        globalStore.clearPendingCommentCell()
    }, [pending, activeSheet])

    const openComment = useMemo(() => {
        if (!open) return null
        return (
            comments.find((c) => c.row === open.row && c.col === open.col) ??
            null
        )
    }, [open, comments])

    const commit = useCallback(
        async (payload: EditPayload) => {
            await dataSvc.handleTransaction({
                payloads: [payload],
                undoable: true,
                temp: false,
            })
            await refresh()
        },
        [dataSvc, refresh]
    )

    if (!globalStore.showComments) return null

    const doAdd = (
        author: Author,
        content: string,
        mentions: CommentMention[],
        parentId?: string
    ) => {
        if (!open) return
        commit({
            type: 'addComment',
            value: {
                sheetIdx: activeSheet,
                row: open.row,
                col: open.col,
                commentId: newGuid(),
                parentId,
                author,
                dt: new Date().toISOString(),
                content,
                mentions,
            },
        })
    }

    const doEdit = (
        commentId: string,
        content: string,
        mentions: CommentMention[]
    ) => {
        commit({
            type: 'editComment',
            value: {sheetIdx: activeSheet, commentId, content, mentions},
        })
    }

    const doDelete = (commentId: string) => {
        const wasRoot = !openComment?.notes.find((n) => n.id === commentId)
            ?.parentId
        commit({
            type: 'deleteComment',
            value: {sheetIdx: activeSheet, commentId},
        })
        if (wasRoot) setOpen(null)
    }

    const doResolve = (commentId: string, resolved: boolean) => {
        commit({
            type: 'resolveComment',
            value: {sheetIdx: activeSheet, commentId, resolved},
        })
    }

    const openRect = open ? rectForCell(open.row, open.col, grid) : null

    return (
        <>
            {comments.map((c) => {
                const rect = rectForCell(c.row, c.col, grid)
                if (!rect) return null
                const resolved = c.notes.find((n) => !n.parentId)?.resolved
                return (
                    <div
                        key={`${c.row}:${c.col}`}
                        className={`${styles.marker} ${
                            resolved ? styles.markerResolved : ''
                        }`}
                        style={{
                            left: rect.x + rect.width - 8,
                            top: rect.y,
                        }}
                        title={`${c.notes.length} comment${
                            c.notes.length === 1 ? '' : 's'
                        }`}
                        onClick={(e) => {
                            e.stopPropagation()
                            setOpen({row: c.row, col: c.col})
                        }}
                    />
                )
            })}

            {open &&
                openRect &&
                createPortal(
                    <>
                        <div
                            className={styles.backdrop}
                            onClick={() => setOpen(null)}
                        />
                        <div
                            className={styles.panel}
                            style={{
                                left:
                                    canvasStartX +
                                    openRect.x +
                                    openRect.width +
                                    4,
                                top: canvasStartY + openRect.y,
                            }}
                        >
                            <CommentThread
                                comment={openComment}
                                onAdd={doAdd}
                                onEdit={doEdit}
                                onDelete={doDelete}
                                onResolve={doResolve}
                                onClose={() => setOpen(null)}
                            />
                        </div>
                    </>,
                    document.body
                )}
        </>
    )
})
