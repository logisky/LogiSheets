import {useEffect, useState, type ReactNode} from 'react'
import type {Author, Comment, CommentNote, CommentMention} from 'logisheets-web'
import {useAuthorService} from '@/core/author'
import styles from './comment-layer.module.scss'

export interface CommentThreadProps {
    /** Existing thread, or null when composing the first note on a cell. */
    comment: Comment | null
    onAdd: (
        author: Author,
        content: string,
        mentions: CommentMention[],
        parentId?: string
    ) => void
    onEdit: (
        commentId: string,
        content: string,
        mentions: CommentMention[]
    ) => void
    onDelete: (commentId: string) => void
    onResolve: (commentId: string, resolved: boolean) => void
    onClose: () => void
}

/**
 * Extract `@name` spans from `text` as mentions. In the open-source app the
 * author types names by hand, so a mention is just a name-only person; an
 * enterprise composer could additionally attach userId/providerId. Offsets are
 * unicode-scalar indices, matching the core / OOXML `startIndex`/`length`.
 */
function extractMentions(text: string): CommentMention[] {
    const mentions: CommentMention[] = []
    const re = /@([^\s@]+)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
        // Convert JS UTF-16 index to unicode-scalar offset.
        const start = Array.from(text.slice(0, m.index)).length
        const len = Array.from(m[0]).length
        mentions.push({
            start,
            len,
            author: {displayName: m[1]},
        })
    }
    return mentions
}

/** Render note content with `@mention` spans styled. */
function renderContent(note: CommentNote): ReactNode {
    if (!note.mentions.length) return note.content
    const chars = Array.from(note.content)
    const spans = [...note.mentions].sort((a, b) => a.start - b.start)
    const out: ReactNode[] = []
    let cursor = 0
    spans.forEach((mn, i) => {
        if (mn.start < cursor) return
        if (mn.start > cursor) out.push(chars.slice(cursor, mn.start).join(''))
        out.push(
            <span key={i} className={styles.mention}>
                {chars.slice(mn.start, mn.start + mn.len).join('')}
            </span>
        )
        cursor = mn.start + mn.len
    })
    if (cursor < chars.length) out.push(chars.slice(cursor).join(''))
    return out
}

function fmtTime(dt: string): string {
    if (!dt) return ''
    const d = new Date(dt)
    if (Number.isNaN(d.getTime())) return dt
    return d.toLocaleString()
}

export function CommentThread({
    comment,
    onAdd,
    onEdit,
    onDelete,
    onResolve,
    onClose,
}: CommentThreadProps) {
    const authorService = useAuthorService()
    const notes = comment?.notes ?? []
    const root = notes.find((n) => !n.parentId) ?? notes[0]
    const resolved = root?.resolved ?? false

    const [draft, setDraft] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editDraft, setEditDraft] = useState('')
    // Resolved current author. In the open-source app this starts empty and the
    // user types their own name; enterprise builds return it from the directory.
    const [author, setAuthor] = useState<Author>({displayName: ''})

    useEffect(() => {
        let alive = true
        authorService.getCurrentAuthor().then((a) => {
            if (alive) setAuthor(a)
        })
        return () => {
            alive = false
        }
    }, [authorService])

    const setAuthorName = (name: string) => {
        const next: Author = {...author, displayName: name}
        setAuthor(next)
        // Persist so the name sticks across threads (DefaultAuthorService only).
        const svc = authorService as {setAuthor?: (a: Author) => void}
        svc.setAuthor?.(next)
    }

    const submit = async () => {
        const text = draft.trim()
        if (!text || !author.displayName.trim()) return
        const mentions = extractMentions(text)
        setDraft('')
        onAdd(author, text, mentions, root?.id)
    }

    const saveEdit = (note: CommentNote) => {
        const text = editDraft.trim()
        setEditingId(null)
        if (!text || text === note.content) return
        onEdit(note.id, text, extractMentions(text))
    }

    return (
        <div className={styles.thread} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
                <span className={styles.title}>
                    {notes.length ? 'Comments' : 'New comment'}
                </span>
                <div className={styles.headerActions}>
                    {root && (
                        <button
                            type="button"
                            className={styles.linkBtn}
                            onClick={() => onResolve(root.id, !resolved)}
                            title={
                                resolved ? 'Reopen thread' : 'Resolve thread'
                            }
                        >
                            {resolved ? 'Reopen' : 'Resolve'}
                        </button>
                    )}
                    <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={onClose}
                        title="Close"
                    >
                        ×
                    </button>
                </div>
            </div>

            {resolved && <div className={styles.resolvedBadge}>Resolved</div>}

            <div className={styles.notes}>
                {notes.map((note) => (
                    <div key={note.id} className={styles.note}>
                        <div className={styles.noteHead}>
                            <span className={styles.author}>
                                {note.author.displayName || 'Unknown'}
                            </span>
                            <span className={styles.time}>
                                {fmtTime(note.dt)}
                            </span>
                        </div>
                        {editingId === note.id ? (
                            <div className={styles.composer}>
                                <textarea
                                    className={styles.textarea}
                                    value={editDraft}
                                    autoFocus
                                    onChange={(e) =>
                                        setEditDraft(e.target.value)
                                    }
                                />
                                <div className={styles.composerActions}>
                                    <button
                                        type="button"
                                        className={styles.linkBtn}
                                        onClick={() => setEditingId(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.primaryBtn}
                                        onClick={() => saveEdit(note)}
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className={styles.content}>
                                    {renderContent(note)}
                                </div>
                                <div className={styles.noteActions}>
                                    <button
                                        type="button"
                                        className={styles.linkBtn}
                                        onClick={() => {
                                            setEditingId(note.id)
                                            setEditDraft(note.content)
                                        }}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.linkBtn}
                                        onClick={() => onDelete(note.id)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>

            <div className={styles.composer}>
                <input
                    className={styles.nameInput}
                    placeholder="Your name"
                    value={author.displayName}
                    onChange={(e) => setAuthorName(e.target.value)}
                />
                <textarea
                    className={styles.textarea}
                    placeholder={
                        notes.length
                            ? 'Reply…  use @name to mention'
                            : 'Add a comment…  use @name to mention'
                    }
                    value={draft}
                    autoFocus={!notes.length}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault()
                            submit()
                        }
                    }}
                />
                <div className={styles.composerActions}>
                    <span className={styles.hint}>⌘/Ctrl+Enter</span>
                    <button
                        type="button"
                        className={styles.primaryBtn}
                        disabled={!draft.trim() || !author.displayName.trim()}
                        onClick={submit}
                    >
                        {notes.length ? 'Reply' : 'Comment'}
                    </button>
                </div>
            </div>
        </div>
    )
}
