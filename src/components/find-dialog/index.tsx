/**
 * FindOverlay — Excel-style Ctrl+F find bar. A non-modal floating panel so
 * the grid stays visible while navigating matches. Opened by the engine's
 * `find` event (see EngineCanvas); it drives the search via {@link find-engine}
 * and moves the selection through `onNavigate`, which scrolls the hit into view.
 */

import {FC, useCallback, useEffect, useRef, useState} from 'react'
import type {Engine} from 'logisheets-engine'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import CloseIcon from '@mui/icons-material/Close'
import {
    buildMatcher,
    findAdjacentIndex,
    findAllMatches,
    type FindMatch,
    type FindOptions,
} from './find-engine'
import styles from './find-dialog.module.scss'

export interface FindOverlayProps {
    open: boolean
    onClose: () => void
    engine: Engine
    sheetIdx: number
    /** Active cell to start searching from; null falls back to A1. */
    getActiveCell: () => FindMatch | null
    /** Select + scroll to a matched cell. */
    onNavigate: (row: number, col: number) => void
}

const SEARCH_DEBOUNCE_MS = 200

export const FindOverlay: FC<FindOverlayProps> = ({
    open,
    onClose,
    engine,
    sheetIdx,
    getActiveCell,
    onNavigate,
}) => {
    const [query, setQuery] = useState('')
    const [options, setOptions] = useState<FindOptions>({
        matchCase: false,
        wholeCell: false,
        useRegex: false,
    })
    const [matches, setMatches] = useState<readonly FindMatch[]>([])
    const [currentIdx, setCurrentIdx] = useState(-1)
    const [searching, setSearching] = useState(false)
    const [regexError, setRegexError] = useState(false)

    const inputRef = useRef<HTMLInputElement>(null)
    // Monotonic token so a stale scan can't overwrite a newer one's result.
    const searchTokenRef = useRef(0)

    // Focus + select the query when the bar opens.
    useEffect(() => {
        if (open) {
            inputRef.current?.focus()
            inputRef.current?.select()
        }
    }, [open])

    // Run (or clear) the search whenever the query, options, sheet, or
    // visibility change. Debounced; older scans are cancelled via the token.
    useEffect(() => {
        if (!open) return
        const token = ++searchTokenRef.current

        if (query === '') {
            setMatches([])
            setCurrentIdx(-1)
            setSearching(false)
            setRegexError(false)
            return
        }

        let matcher: (text: string) => boolean
        try {
            matcher = buildMatcher(query, options)
            setRegexError(false)
        } catch {
            setRegexError(true)
            setMatches([])
            setCurrentIdx(-1)
            setSearching(false)
            return
        }

        setSearching(true)
        const signal = {cancelled: false}
        const timer = setTimeout(async () => {
            const result = await findAllMatches(engine, sheetIdx, matcher, signal)
            if (signal.cancelled || token !== searchTokenRef.current) return
            setMatches(result)
            setCurrentIdx(-1)
            setSearching(false)
        }, SEARCH_DEBOUNCE_MS)

        return () => {
            signal.cancelled = true
            clearTimeout(timer)
        }
    }, [open, query, options, sheetIdx, engine])

    // Re-run the current search when cell values change while the bar is open,
    // so the match set and counter stay in sync with edits.
    useEffect(() => {
        if (!open) return
        // Bump `options` to a fresh object so the search effect re-runs with
        // the latest cell values (its deps include `options`).
        const handler = () => setOptions((o) => ({...o}))
        engine.on('cellChange', handler)
        return () => engine.off('cellChange', handler)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, engine])

    const go = useCallback(
        (direction: 'next' | 'prev') => {
            if (matches.length === 0) return
            let idx: number
            if (currentIdx === -1) {
                const from = getActiveCell() ?? {row: 0, col: 0}
                idx = findAdjacentIndex(matches, from, direction)
            } else {
                const delta = direction === 'next' ? 1 : -1
                idx = (currentIdx + delta + matches.length) % matches.length
            }
            setCurrentIdx(idx)
            onNavigate(matches[idx].row, matches[idx].col)
        },
        [matches, currentIdx, getActiveCell, onNavigate]
    )

    const onKeyDown = (e: React.KeyboardEvent) => {
        // Keep keystrokes from leaking to the grid's key handler.
        e.stopPropagation()
        if (e.key === 'Enter') {
            e.preventDefault()
            go(e.shiftKey ? 'prev' : 'next')
        } else if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
        }
    }

    if (!open) return null

    const hasQuery = query !== ''
    const countLabel = regexError
        ? 'Invalid regex'
        : searching
          ? 'Searching…'
          : !hasQuery
            ? ''
            : matches.length === 0
              ? 'No results'
              : currentIdx === -1
                ? `${matches.length} found`
                : `${currentIdx + 1} of ${matches.length}`

    const navDisabled = matches.length === 0

    return (
        <div className={styles.findBar} onKeyDown={onKeyDown}>
            <div className={styles.row}>
                <input
                    ref={inputRef}
                    className={`${styles.input} ${regexError ? styles.inputError : ''}`}
                    placeholder="Find in sheet"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <span className={styles.count}>{countLabel}</span>
                <button
                    type="button"
                    className={styles.iconBtn}
                    title="Previous (Shift+Enter)"
                    disabled={navDisabled}
                    onClick={() => go('prev')}
                >
                    <KeyboardArrowUpIcon fontSize="small" />
                </button>
                <button
                    type="button"
                    className={styles.iconBtn}
                    title="Next (Enter)"
                    disabled={navDisabled}
                    onClick={() => go('next')}
                >
                    <KeyboardArrowDownIcon fontSize="small" />
                </button>
                <button
                    type="button"
                    className={styles.iconBtn}
                    title="Close (Esc)"
                    onClick={onClose}
                >
                    <CloseIcon fontSize="small" />
                </button>
            </div>
            <div className={styles.options}>
                <label className={styles.option}>
                    <input
                        type="checkbox"
                        checked={options.matchCase}
                        onChange={(e) =>
                            setOptions((o) => ({...o, matchCase: e.target.checked}))
                        }
                    />
                    Match case
                </label>
                <label className={styles.option}>
                    <input
                        type="checkbox"
                        checked={options.wholeCell}
                        onChange={(e) =>
                            setOptions((o) => ({...o, wholeCell: e.target.checked}))
                        }
                    />
                    Whole cell
                </label>
                <label className={styles.option}>
                    <input
                        type="checkbox"
                        checked={options.useRegex}
                        onChange={(e) =>
                            setOptions((o) => ({...o, useRegex: e.target.checked}))
                        }
                    />
                    Regex
                </label>
            </div>
        </div>
    )
}

export default FindOverlay
