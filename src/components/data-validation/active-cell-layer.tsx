/**
 * What a data-validation rule shows on the active cell, as Excel does:
 *   - a `list` rule with an in-cell dropdown gets an arrow beside the cell,
 *     opening its options; picking one types it in;
 *   - a rule with an input message shows it under the cell.
 *
 * Lives in the view overlay, so every view (main, split, pop-out) gets it for
 * its own selection. Reads the rule on each selection change; nothing here
 * caches it, since a rule can change under the selection.
 */

import {useCallback, useEffect, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import Box from '@mui/material/Box'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import {
    getSelectedCellRange,
    isErrorMessage,
    xForColStart,
    yForRowStart,
} from 'logisheets-engine'
import type {DataValidationSpec, Grid, SelectedData} from 'logisheets-engine'
import {parseA1notation} from 'logisheets-core'
import {ContextMenu, ContextMenuItem} from '@/ui/context-menu'
import {useEngine, useOps} from '@/core/engine/provider'
import {LeftTop} from '@/core/settings'
import {formulaToSource} from './form'
import {valueToSearchString} from '@/components/find-dialog/find-engine'

export interface ActiveCellValidationLayerProps {
    grid: Grid
    activeSheet: number
    selectedData?: SelectedData
}

/** Upper bound on options read from a range source; Excel's lists are short. */
const MAX_OPTIONS = 500

export function ActiveCellValidationLayer({
    grid,
    activeSheet,
    selectedData,
}: ActiveCellValidationLayerProps) {
    const {t} = useTranslation()
    const engine = useEngine()
    const ops = useOps()
    const [spec, setSpec] = useState<DataValidationSpec | null>(null)
    const [options, setOptions] = useState<readonly string[] | null>(null)
    const anchorRef = useRef<HTMLDivElement>(null)

    const cell = selectedData ? getSelectedCellRange(selectedData) : undefined
    const row = cell?.startRow
    const col = cell?.startCol

    // Any edit may have set or cleared the rule under an unmoved selection.
    const [revision, setRevision] = useState(0)
    useEffect(() => {
        const bump = () => setRevision((r) => r + 1)
        engine.on('cellChange', bump)
        return () => engine.off('cellChange', bump)
    }, [engine])

    // Moving to another cell closes an open list and drops the old rule at
    // once; a re-read after an edit just replaces it, without flicker.
    useEffect(() => {
        setSpec(null)
        setOptions(null)
    }, [activeSheet, row, col])

    useEffect(() => {
        if (row === undefined || col === undefined) return
        let live = true
        void engine
            .getWorkbook()
            .getDataValidation({sheetIdx: activeSheet, row, col})
            .then((info) => {
                if (live && !isErrorMessage(info)) setSpec(info?.spec ?? null)
            })
        return () => {
            live = false
        }
    }, [engine, activeSheet, row, col, revision])

    /** A list's options: inline ones as written, a range's from its cells. */
    const loadOptions = useCallback(async (): Promise<string[]> => {
        if (!spec) return []
        const source = formulaToSource(spec.formula1)
        if (!source.startsWith('=')) {
            return source
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s !== '')
        }
        const ref = source.slice(1)
        const bang = ref.lastIndexOf('!')
        let sheetIdx = activeSheet
        if (bang >= 0) {
            const name = ref
                .slice(0, bang)
                .replace(/^'(.*)'$/, '$1')
                .replace(/''/g, "'")
            const sheets = await engine.getWorkbook().getAllSheetInfo()
            if (isErrorMessage(sheets)) return []
            sheetIdx = sheets.findIndex((s) => s.name === name)
            if (sheetIdx < 0) return []
        }
        // A plain range only; a defined name is not resolved here.
        const r = parseA1notation(ref.slice(bang + 1).replace(/\$/g, ''))
        if (!r) return []
        const endRow = Math.min(r.re ?? r.rs, r.rs + MAX_OPTIONS - 1)
        const cells = await engine.getWorkbook().getCells({
            sheetIdx,
            startRow: r.rs,
            startCol: r.cs,
            endRow,
            endCol: r.ce ?? r.cs,
        })
        if (isErrorMessage(cells)) return []
        return [
            ...new Set(
                cells
                    .map((c) => valueToSearchString(c.value))
                    .filter((s) => s !== '')
            ),
        ]
    }, [spec, engine, activeSheet])

    if (row === undefined || col === undefined || !spec) return null
    // Scrolled out of view: the grid only knows the lines it laid out.
    const colInfo = grid.columns.find(
        (c: {idx: number; width: number}) => c.idx === col
    )
    const rowInfo = grid.rows.find(
        (r: {idx: number; height: number}) => r.idx === row
    )
    if (!colInfo || !rowInfo) return null

    const x = xForColStart(col, grid) + LeftTop.width
    const y = yForRowStart(row, grid) + LeftTop.height
    const dropdown = spec.ty === 'list' && spec.inCellDropdown
    const prompt = spec.prompt || spec.promptTitle

    return (
        <>
            {dropdown && (
                <Box
                    ref={anchorRef}
                    role="button"
                    aria-label={String(t('ui.dv.pick'))}
                    title={String(t('ui.dv.pick'))}
                    // Keep the press from reaching the grid, which would
                    // select the cell under the arrow and drop the rule.
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                    }}
                    onClick={async () => setOptions(await loadOptions())}
                    sx={{
                        position: 'absolute',
                        left: x + colInfo.width + 1,
                        top: y,
                        width: 18,
                        height: rowInfo.height,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: '#fff',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: '3px',
                        color: 'text.secondary',
                        cursor: 'pointer',
                        pointerEvents: 'auto',
                        // Above the canvas, like the comment markers.
                        zIndex: 5,
                        '&:hover': {bgcolor: '#f1f3f5'},
                    }}
                >
                    <ArrowDropDownIcon sx={{fontSize: 18}} />
                </Box>
            )}
            {prompt && !options && (
                <Box
                    sx={{
                        position: 'absolute',
                        left: x + 8,
                        top: y + rowInfo.height + 6,
                        maxWidth: 240,
                        px: 1.25,
                        py: 0.75,
                        bgcolor: '#fffbe6',
                        border: '1px solid #e8dca0',
                        borderRadius: 1,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        fontSize: 12,
                        lineHeight: 1.45,
                        color: '#374151',
                        pointerEvents: 'none',
                        whiteSpace: 'pre-wrap',
                        zIndex: 5,
                    }}
                >
                    {spec.promptTitle && (
                        <Box sx={{fontWeight: 600}}>{spec.promptTitle}</Box>
                    )}
                    {spec.prompt}
                </Box>
            )}
            <ContextMenu
                open={!!options && !!anchorRef.current}
                anchorEl={anchorRef.current}
                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'right'}}
                onClose={() => setOptions(null)}
            >
                {(options ?? []).map((o) => (
                    <ContextMenuItem
                        key={o}
                        onClick={() => {
                            setOptions(null)
                            void ops.inputCell(activeSheet, row, col, o)
                        }}
                    >
                        {o}
                    </ContextMenuItem>
                ))}
            </ContextMenu>
        </>
    )
}
