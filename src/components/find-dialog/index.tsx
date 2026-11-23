/**
 * FindOverlay — Excel-style Ctrl+F find bar, with a Replace row that folds out
 * (Ctrl+H opens it that way). A non-modal floating panel so the grid stays
 * visible while navigating matches. Opened by the engine's `find` event (see
 * EngineCanvas); it drives the search via {@link find-engine} and moves the
 * selection through `onNavigate`, which scrolls the hit into view.
 *
 * Replace rewrites cell VALUES only: a match whose value is a formula's result
 * is skipped, since writing over it would replace the formula with a constant.
 */

import {FC, useCallback, useEffect, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import type {Engine} from 'logisheets-engine'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import CloseIcon from '@mui/icons-material/Close'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type {Payload} from 'logisheets-web'
import {useOps} from '@/core/engine/provider'
import {useToast} from '@/ui/notification/useToast'
import {
    buildMatcher,
    buildReplacer,
    findAdjacentIndex,
    findAllMatches,
    type FindMatch,
    type FindOptions,
    type FoundCell,
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
    /** Open with the Replace row showing (Ctrl+H). Re-read on every open. */
    replaceMode?: boolean
}

const SEARCH_DEBOUNCE_MS = 200

export const FindOverlay: FC<FindOverlayProps> = ({
    open,
    onClose,
    engine,
    sheetIdx,
    getActiveCell,
    onNavigate,
    replaceMode = false,
}) => {
    const {t} = useTranslation()
    const ops = useOps()
    const {toast} = useToast()
    const [query, setQuery] = useState('')
    const [showReplace, setShowReplace] = useState(replaceMode)
    const [replacement, setReplacement] = useState('')
    const [options, setOptions] = useState<FindOptions>({
        matchCase: false,
        wholeCell: false,
        useRegex: false,
    })
    const [matches, setMatches] = useState<readonly FoundCell[]>([])
    const [currentIdx, setCurrentIdx] = useState(-1)
    const [searching, setSearching] = useState(false)
    const [regexError, setRegexError] = useState(false)

    const inputRef = useRef<HTMLInputElement>(null)
    // Monotonic token so a stale scan can't overwrite a newer one's result.
    const searchTokenRef = useRef(0)

    // Focus + select the query when the bar opens; Ctrl+H opens it with the
    // Replace row out, Ctrl+F leaves the row as the user last had it.
    useEffect(() => {
        if (open) {
            if (replaceMode) setShowReplace(true)
            inputRef.current?.focus()
            inputRef.current?.select()
        }
    }, [open, replaceMode])

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
            const result = await findAllMatches(
                engine,
                sheetIdx,
                matcher,
                signal
            )
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

    /** The payload that rewrites one match, or null when it is skipped. */
    const rewrite = (
        m: FoundCell,
        replace: (text: string) => string
    ): Payload | null => {
        if (m.isFormula) return null
        const content = replace(m.text)
        if (content === m.text) return null
        return {
            type: 'cellInput',
            value: {sheetIdx, row: m.row, col: m.col, content},
        } as Payload
    }

    const makeReplacer = () => {
        try {
            return buildReplacer(query, replacement, options)
        } catch {
            return null
        }
    }

    // Excel's Replace: the first press only finds; once a match is current,
    // replace it and move on. The edit re-runs the search (cellChange), so the
    // next press starts again from the active cell.
    const replaceOne = async () => {
        if (currentIdx === -1) return go('next')
        const replace = makeReplacer()
        const m = matches[currentIdx]
        if (!replace || !m) return
        const payload = rewrite(m, replace)
        if (!payload) {
            if (m.isFormula)
                toast(String(t('ui.find.formulaSkipped')), {type: 'info'})
            return go('next')
        }
        await ops.applyPayloads([payload])
    }

    // One transaction, so one undo step brings every cell back.
    const replaceAll = async () => {
        const replace = makeReplacer()
        if (!replace || matches.length === 0) return
        const payloads = matches
            .map((m) => rewrite(m, replace))
            .filter((p): p is Payload => p !== null)
        const skipped = matches.filter((m) => m.isFormula).length
        if (payloads.length > 0) await ops.applyPayloads(payloads)
        toast(
            String(
                skipped > 0
                    ? t('ui.find.replacedSkipped', {
                          count: payloads.length,
                          skipped,
                      })
                    : t('ui.find.replaced', {count: payloads.length})
            ),
            {type: 'info'}
        )
    }

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
        ? String(t('ui.find.invalidRegex'))
        : searching
          ? String(t('ui.find.searching'))
          : !hasQuery
            ? ''
            : matches.length === 0
              ? String(t('ui.find.noResults'))
              : currentIdx === -1
                ? String(t('ui.find.found', {count: matches.length}))
                : String(
                      t('ui.find.position', {
                          index: currentIdx + 1,
                          count: matches.length,
                      })
                  )

    const navDisabled = matches.length === 0

    return (
        <div className={styles.findBar} onKeyDown={onKeyDown}>
            <div className={styles.row}>
                <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.toggle} ${
                        showReplace ? styles.toggleOpen : ''
                    }`}
                    title={String(t('ui.find.toggleReplace'))}
                    aria-expanded={showReplace}
                    onClick={() => setShowReplace((v) => !v)}
                >
                    <ChevronRightIcon fontSize="small" />
                </button>
                <input
                    ref={inputRef}
                    className={`${styles.input} ${
                        regexError ? styles.inputError : ''
                    }`}
                    placeholder={String(t('ui.find.title'))}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <span className={styles.count}>{countLabel}</span>
                <button
                    type="button"
                    className={styles.iconBtn}
                    title={String(t('ui.find.previous'))}
                    disabled={navDisabled}
                    onClick={() => go('prev')}
                >
                    <KeyboardArrowUpIcon fontSize="small" />
                </button>
                <button
                    type="button"
                    className={styles.iconBtn}
                    title={String(t('ui.find.next'))}
                    disabled={navDisabled}
                    onClick={() => go('next')}
                >
                    <KeyboardArrowDownIcon fontSize="small" />
                </button>
                <button
                    type="button"
                    className={styles.iconBtn}
                    title={String(t('ui.find.close'))}
                    onClick={onClose}
                >
                    <CloseIcon fontSize="small" />
                </button>
            </div>
            {showReplace ? (
                <div className={styles.row}>
                    <span className={styles.toggleSpacer} />
                    <input
                        className={styles.input}
                        placeholder={String(t('ui.find.replaceWith'))}
                        value={replacement}
                        onChange={(e) => setReplacement(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key !== 'Enter') return
                            // Keep Enter here from also stepping the search.
                            e.preventDefault()
                            e.stopPropagation()
                            void (e.metaKey || e.ctrlKey
                                ? replaceAll()
                                : replaceOne())
                        }}
                    />
                    <button
                        type="button"
                        className={styles.textBtn}
                        title={String(t('ui.find.replaceTip'))}
                        disabled={navDisabled}
                        onClick={() => void replaceOne()}
                    >
                        {t('ui.find.replace')}
                    </button>
                    <button
                        type="button"
                        className={styles.textBtn}
                        title={String(t('ui.find.replaceAllTip'))}
                        disabled={navDisabled}
                        onClick={() => void replaceAll()}
                    >
                        {t('ui.find.replaceAll')}
                    </button>
                </div>
            ) : null}
            <div className={styles.options}>
                <label className={styles.option}>
                    <input
                        type="checkbox"
                        checked={options.matchCase}
                        onChange={(e) =>
                            setOptions((o) => ({
                                ...o,
                                matchCase: e.target.checked,
                            }))
                        }
                    />
                    {t('ui.find.matchCase')}
                </label>
                <label className={styles.option}>
                    <input
                        type="checkbox"
                        checked={options.wholeCell}
                        onChange={(e) =>
                            setOptions((o) => ({
                                ...o,
                                wholeCell: e.target.checked,
                            }))
                        }
                    />
                    {t('ui.find.wholeCell')}
                </label>
                <label className={styles.option}>
                    <input
                        type="checkbox"
                        checked={options.useRegex}
                        onChange={(e) =>
                            setOptions((o) => ({
                                ...o,
                                useRegex: e.target.checked,
                            }))
                        }
                    />
                    {t('ui.find.regex')}
                </label>
            </div>
        </div>
    )
}

export default FindOverlay
