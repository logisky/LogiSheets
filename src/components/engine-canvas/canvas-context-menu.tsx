/**
 * Host-rendered right-click menu for the spreadsheet canvas.
 *
 * The engine itself renders no menu — it just emits a `contextMenu` event with
 * the trigger context and screen position. This component subscribes to that
 * event (via `subscribe`) and renders the app's own MUI menu: cell actions
 * (Format / Clear), and row/column header actions (insert above/below with an
 * inline count stepper, format, delete). Insert shifts the selection to follow
 * the data.
 *
 * Because the menu lives entirely in the host, a different app could render a
 * completely different menu from the same event — the engine imposes nothing.
 */

import {useState, useEffect, useCallback, useRef, type ReactNode} from 'react'
import {useTranslation} from 'react-i18next'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined'
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import AddLinkOutlinedIcon from '@mui/icons-material/AddLinkOutlined'
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import NorthEastOutlinedIcon from '@mui/icons-material/NorthEastOutlined'
import SouthWestOutlinedIcon from '@mui/icons-material/SouthWestOutlined'
import LayersClearOutlinedIcon from '@mui/icons-material/LayersClearOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import HideImageOutlinedIcon from '@mui/icons-material/HideImageOutlined'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import {ContextMenu, ContextMenuItem} from '@/ui/context-menu'
import Box from '@mui/material/Box'
import type {
    BlockInfo,
    ContextMenuContext,
    SelectedData,
    Transaction,
    Payload,
    DataService,
    SessionEventMap,
} from 'logisheets-engine'
import {autoSumPayload} from '@/core/auto-sum'
import {
    isErrorMessage,
    getSelectedCellRange,
    getSelectedLines,
} from 'logisheets-engine'
import FormatDialogContent, {
    type FormatDialogValue,
} from '@/components/format-dialog'
import {BlockComposerComponent} from '@/components/block-composer'
import {ConditionalFormattingDialog} from '@/components/conditional-formatting'
import {DataValidationDialog} from '@/components/data-validation'
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined'
import {inferBlockFromSelection} from '@/components/block-composer/infer-selection'
import type {FieldSetting} from 'logisheets-core'
import {useToast} from '@/ui/notification/useToast'
import {globalStore} from '@/store'
import {useOps} from '@/core/engine/provider'
import {Dialog} from '@/ui/dialog'
import type {HyperlinkInfo} from 'logisheets-web'
import {getHyperlink} from '@/core/hyperlinks'
import {
    HyperlinkDialog,
    useFollowHyperlink,
    type HyperlinkTarget,
} from '@/components/hyperlink'

/** Payload of the engine/session `contextMenu` event. */
export interface ContextMenuTrigger {
    context: ContextMenuContext
    x: number
    y: number
}

/** Number of selected lines for the active row/column trigger (min 1). */
function selectedLineCount(ctx: ContextMenuContext): number {
    const lines = getSelectedLines(ctx.selectedData)
    if (!lines) return 1
    return Math.abs(lines.end - lines.start) + 1
}

/** Inclusive [lo, hi] of the selected line range, or the clicked index. */
function selectedLineRange(ctx: ContextMenuContext): [number, number] {
    const lines = getSelectedLines(ctx.selectedData)
    if (lines)
        return [
            Math.min(lines.start, lines.end),
            Math.max(lines.start, lines.end),
        ]
    const idx = (ctx.target === 'row' ? ctx.row : ctx.col) ?? 0
    return [idx, idx]
}

/**
 * Excel's Ctrl+Shift number formats, by shortcut id. Currency follows the
 * UI language at the call site (yen for Chinese), as Excel follows the
 * locale.
 */
const SHORTCUT_NUM_FMTS = {
    numFmtGeneral: 'General',
    numFmtNumber: '#,##0.00',
    numFmtTime: 'h:mm AM/PM',
    numFmtDate: 'd-mmm-yy',
    numFmtCurrency: '"$"#,##0.00',
    numFmtPercent: '0%',
    numFmtScientific: '0.00E+00',
} as const

/** The selection's inclusive [lo, hi] along `axis`, or null if it has none. */
function linesAlong(
    selectedData: SelectedData,
    axis: 'row' | 'col'
): [number, number] | null {
    const r = getSelectedCellRange(selectedData)
    if (r)
        return axis === 'row'
            ? [Math.min(r.startRow, r.endRow), Math.max(r.startRow, r.endRow)]
            : [Math.min(r.startCol, r.endCol), Math.max(r.startCol, r.endCol)]
    const l = getSelectedLines(selectedData)
    if (l && l.type === axis)
        return [Math.min(l.start, l.end), Math.max(l.start, l.end)]
    return null
}

const lineSelection = (
    start: number,
    end: number,
    type: 'row' | 'col'
): SelectedData => ({source: 'none', data: {ty: 'line', d: {start, end, type}}})

export interface CanvasContextMenuProps {
    /**
     * Subscribe to the view's `contextMenu` event; returns an unsubscribe.
     * (Wraps `engine.on`/`session.on` so the menu works for any view.)
     */
    subscribe: (cb: (e: ContextMenuTrigger) => void) => () => void
    dataSvc: DataService
    /** Current active sheet index (read at click time). */
    getActiveSheet: () => number
    /** Apply a new selection (state + engine/session). */
    setSelection: (data: SelectedData) => void
    /** Switch this view's sheet — "Open link" can lead to another sheet. */
    setActiveSheet: (idx: number) => void
    /**
     * Subscribe to the view's `shortcutIntent` event, so the keyboard twins
     * of the menu's items (format cells, convert to block, hide / unhide,
     * AutoSum) work too. Returns an unsubscribe.
     */
    subscribeShortcut?: (
        cb: (e: SessionEventMap['shortcutIntent']) => void
    ) => () => void
}

export function CanvasContextMenu({
    subscribe,
    dataSvc,
    getActiveSheet,
    setSelection,
    setActiveSheet,
    subscribeShortcut,
}: CanvasContextMenuProps): ReactNode {
    const {t, i18n} = useTranslation()
    const {toast} = useToast()
    const ops = useOps()
    const [menu, setMenu] = useState<{
        x: number
        y: number
        context: ContextMenuContext
    } | null>(null)
    const [count, setCount] = useState(1)
    const [fmtOpen, setFmtOpen] = useState(false)
    const [fmtSelectedData, setFmtSelectedData] = useState<SelectedData | null>(
        null
    )
    const [fmtValue, setFmtValue] = useState<FormatDialogValue>({})
    // Conditional formatting manager. Opened over the current selection, which
    // is the range a newly created rule covers.
    const [cfRange, setCfRange] = useState<{
        sheetIdx: number
        startRow: number
        startCol: number
        endRow: number
        endCol: number
    } | null>(null)
    // Data validation, opened over the selection the same way.
    const [dvRange, setDvRange] = useState<typeof cfRange>(null)
    // "Link range → block": the picker lists blocks with a matching column count
    // that aren't already linked; picking one sends a CreateLink payload.
    const [linkOpen, setLinkOpen] = useState(false)
    const [linkBlocks, setLinkBlocks] = useState<BlockInfo[]>([])
    const [linkTarget, setLinkTarget] = useState<{
        sheetIdx: number
        masterRow: number
        masterCol: number
        rowCnt: number
        colCnt: number
        /** The selection that triggered the link, kept for convert-mode create. */
        selectedData: SelectedData
    } | null>(null)
    // "Create new block" path: reuse the block-composer in *convert* mode over
    // the selected region (keeps its data + remaps formulas). We stash the
    // selection + its dimensions so the composer can convert it in place.
    const [convertComposer, setConvertComposer] = useState<{
        selectedData: SelectedData
        rowCnt: number
        colCnt: number
        /** Inferred schema for the Ctrl+T-style "Convert to block" entry. */
        initialFields?: FieldSetting[]
    } | null>(null)
    // "Edit block" path: when the right-clicked cell falls inside an existing
    // form block, we resolve its ids on menu-open (async hit-test) into
    // `editCandidate`, which gates the "Edit block…" item. Picking it opens the
    // composer in edit mode over that block.
    const [editCandidate, setEditCandidate] = useState<{
        sheetIdx: number
        sheetId: number
        blockId: number
    } | null>(null)
    const [editComposer, setEditComposer] = useState<{
        sheetIdx: number
        sheetId: number
        blockId: number
    } | null>(null)
    // The link on the right-clicked cell, resolved on menu-open. Gates the
    // Open / Edit / Remove link items.
    const [menuLink, setMenuLink] = useState<{
        target: HyperlinkTarget
        link: HyperlinkInfo | null
    } | null>(null)
    const [linkDialog, setLinkDialog] = useState<HyperlinkTarget | null>(null)
    const followLink = useFollowHyperlink({
        dataSvc,
        setActiveSheet,
        setSelection,
    })

    // Keep the latest service + active-sheet accessor reachable from the
    // one-time `subscribe` effect without re-subscribing on every render.
    const dataSvcRef = useRef(dataSvc)
    dataSvcRef.current = dataSvc
    const getActiveSheetRef = useRef(getActiveSheet)
    getActiveSheetRef.current = getActiveSheet

    useEffect(() => {
        return subscribe((e) => {
            setMenu({x: e.x, y: e.y, context: e.context})
            setCount(selectedLineCount(e.context))
            // Resolve whether the click landed inside an existing form block so
            // the "Edit block…" item can appear. Enumerate the sheet's blocks
            // and find the one whose rect contains the anchor cell.
            setEditCandidate(null)
            setMenuLink(null)
            const ctx = e.context
            if (ctx.target !== 'cell') return
            // Hit-test the CLICKED cell, not the selection's top-left — a
            // persisted multi-cell selection would otherwise miss a block that
            // doesn't start at the selection anchor.
            const range = getSelectedCellRange(ctx.selectedData)
            const row = ctx.row ?? range?.startRow
            const col = ctx.col ?? range?.startCol
            if (row === undefined || col === undefined) return
            const sheetIdx = getActiveSheetRef.current()
            const target = {sheetIdx, row, col}
            setMenuLink({target, link: null})
            void getHyperlink(dataSvcRef.current, sheetIdx, row, col).then(
                (link) =>
                    setMenuLink((m) =>
                        m?.target === target ? {target, link} : m
                    )
            )
            void (async () => {
                const wb = dataSvcRef.current.getWorkbook()
                const res = await wb.getAllBlocks({sheetIdx})
                if (isErrorMessage(res)) return
                const hit = res.find(
                    (b) =>
                        !!b.schema &&
                        row >= b.rowStart &&
                        row < b.rowStart + b.rowCnt &&
                        col >= b.colStart &&
                        col < b.colStart + b.colCnt
                )
                if (!hit) return
                setEditCandidate({
                    sheetIdx: hit.sheetIdx,
                    sheetId: hit.sheetId,
                    blockId: hit.blockId,
                })
            })()
        })
    }, [subscribe])

    const close = () => setMenu(null)

    const doTxn = useCallback(
        (payloads: Payload[]) => {
            const tx: Transaction = {payloads, undoable: true, temp: false}
            return dataSvc.handleTransaction(tx)
        },
        [dataSvc]
    )

    // The selection a range dialog applies to — falling back to the clicked
    // cell when nothing is selected, so the item works on a bare right-click.
    const rangeOf = (ctx: ContextMenuContext) => {
        const range = getSelectedCellRange(ctx.selectedData)
        const startRow = range?.startRow ?? ctx.row ?? 0
        const startCol = range?.startCol ?? ctx.col ?? 0
        return {
            sheetIdx: getActiveSheet(),
            startRow,
            startCol,
            endRow: range?.endRow ?? startRow,
            endCol: range?.endCol ?? startCol,
        }
    }

    const openConditionalFormatting = (ctx: ContextMenuContext) => {
        close()
        setCfRange(rangeOf(ctx))
    }

    const openDataValidation = (ctx: ContextMenuContext) => {
        close()
        setDvRange(rangeOf(ctx))
    }

    const openFormatFor = (selectedData: SelectedData) => {
        setFmtSelectedData(selectedData)
        setFmtValue({})
        setFmtOpen(true)
    }
    const openFormat = (ctx: ContextMenuContext) => {
        openFormatFor(ctx.selectedData)
        close()
    }

    const clearCells = async (ctx: ContextMenuContext) => {
        close()
        const range = getSelectedCellRange(ctx.selectedData)
        if (!range) return
        const sheetIdx = getActiveSheet()
        const payloads: Payload[] = []
        for (let r = range.startRow; r <= range.endRow; r++) {
            for (let c = range.startCol; c <= range.endCol; c++) {
                payloads.push({
                    type: 'cellClear',
                    value: {sheetIdx, row: r, col: c},
                })
            }
        }
        await doTxn(payloads)
    }

    // Insert `count` lines. `where` decides above/below (left/right). The
    // selection shifts to follow the original lines when inserting before them.
    const insertLines = async (
        ctx: ContextMenuContext,
        axis: 'row' | 'col',
        where: 'before' | 'after'
    ) => {
        close()
        const sheetIdx = getActiveSheet()
        const [lo, hi] = selectedLineRange(ctx)
        const start = where === 'before' ? lo : hi + 1
        const type = axis === 'row' ? 'insertRows' : 'insertCols'
        const r = await doTxn([
            {type, value: {sheetIdx, start, count}} as Payload,
        ])
        if (isErrorMessage(r)) return
        if (where === 'before') {
            setSelection(lineSelection(lo + count, hi + count, axis))
        } else {
            setSelection(lineSelection(lo, hi, axis))
        }
    }

    const deleteLines = async (
        ctx: ContextMenuContext,
        axis: 'row' | 'col'
    ) => {
        close()
        const sheetIdx = getActiveSheet()
        const [lo, hi] = selectedLineRange(ctx)
        const type = axis === 'row' ? 'deleteRows' : 'deleteCols'
        const r = await doTxn([
            {type, value: {sheetIdx, start: lo, count: hi - lo + 1}} as Payload,
        ])
        if (!isErrorMessage(r)) setSelection({source: 'none'})
    }

    // Hide the selected lines, or show them again. Unhide also reaches the
    // hidden runs right beside the selection — see WorkbookOps.unhideLines.
    const setLinesHidden = async (
        ctx: ContextMenuContext,
        axis: 'row' | 'col',
        hidden: boolean
    ) => {
        close()
        const [lo, hi] = selectedLineRange(ctx)
        await setRangeHidden(axis, lo, hi, hidden)
    }

    const setRangeHidden = async (
        axis: 'row' | 'col',
        lo: number,
        hi: number,
        hidden: boolean
    ) => {
        const sheetIdx = getActiveSheet()
        try {
            if (hidden) {
                await ops.setLinesVisible(sheetIdx, axis, lo, hi, false)
                // A selection of hidden lines has nothing to sit on and is
                // drawn over the next visible line instead — which would then
                // look selected while Delete cleared the hidden ones.
                setSelection({source: 'none'})
            } else await ops.unhideLines(sheetIdx, axis, lo, hi)
        } catch (e) {
            toast(e instanceof Error ? e.message : String(e), {type: 'error'})
        }
    }

    const stepper = (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 0.5,
                fontSize: 14,
            }}
            // Adjusting the count must not close the menu.
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
        >
            <span style={{flex: 1}}>{t('ui.menu.count')}</span>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    border: '1px solid #d0d0d0',
                    borderRadius: 1,
                    overflow: 'hidden',
                }}
            >
                <button
                    type="button"
                    aria-label={String(t('ui.menu.decrease'))}
                    onClick={() => setCount((c) => Math.max(1, c - 1))}
                    style={stepBtnStyle}
                >
                    −
                </button>
                <input
                    type="number"
                    min={1}
                    max={1000}
                    value={count}
                    onChange={(e) => {
                        const v = parseInt(e.target.value, 10)
                        setCount(
                            Number.isNaN(v) ? 1 : Math.min(1000, Math.max(1, v))
                        )
                    }}
                    style={stepInputStyle}
                />
                <button
                    type="button"
                    aria-label={String(t('ui.menu.increase'))}
                    onClick={() => setCount((c) => Math.min(1000, c + 1))}
                    style={stepBtnStyle}
                >
                    +
                </button>
            </Box>
        </Box>
    )

    const addComment = (ctx: ContextMenuContext) => {
        close()
        const range = getSelectedCellRange(ctx.selectedData)
        if (!range) return
        globalStore.requestAddComment({
            sheetIdx: getActiveSheet(),
            row: range.startRow,
            col: range.startCol,
        })
    }

    // Formula auditing: raise a one-shot trace request for the clicked cell;
    // TraceLayer fulfills it (get_precedents / get_dependents) and highlights.
    const traceCell = (
        ctx: ContextMenuContext,
        kind: 'precedents' | 'dependents'
    ) => {
        close()
        const range = getSelectedCellRange(ctx.selectedData)
        if (!range) return
        globalStore.requestTrace({
            sheetIdx: getActiveSheet(),
            row: range.startRow,
            col: range.startCol,
            kind,
        })
    }

    // Link the selected range to an existing block: fetch the blocks it can link
    // to (same column count, not already linked) and open the picker.
    const openLink = async (ctx: ContextMenuContext) => {
        close()
        const range = getSelectedCellRange(ctx.selectedData)
        if (!range) return
        const sheetIdx = getActiveSheet()
        const colCnt = range.endCol - range.startCol + 1
        const rowCnt = range.endRow - range.startRow + 1
        const res = await dataSvc.getWorkbook().getLinkableBlocks({
            sheetIdx,
            colCnt,
        })
        if (isErrorMessage(res)) return
        setLinkTarget({
            sheetIdx,
            masterRow: range.startRow,
            masterCol: range.startCol,
            rowCnt,
            colCnt,
            selectedData: ctx.selectedData,
        })
        setLinkBlocks(res as BlockInfo[])
        setLinkOpen(true)
    }

    const pickBlock = async (blockId: number) => {
        setLinkOpen(false)
        if (!linkTarget) return
        const {sheetIdx, masterRow, masterCol, rowCnt, colCnt} = linkTarget
        await doTxn([
            {
                type: 'createLink',
                value: {
                    sheetIdx,
                    masterRow,
                    masterCol,
                    rowCnt,
                    colCnt,
                    blockId,
                },
            } as Payload,
        ])
        // Linking an empty range changes no cell value, so the grid may not
        // re-render — nudge LinkLayer to refetch and draw the border now.
        globalStore.bumpLinkRevision()
    }

    // No suitable block yet — turn the selection into a fresh, growable block.
    // Reuses the block-composer in *convert* mode (ref name + one field per
    // selected column) so the block is visible + schema'd and formulas over the
    // region get remapped to track it. A bare convert would be invisible.
    const createNewBlock = () => {
        setLinkOpen(false)
        if (!linkTarget) return
        setConvertComposer({
            selectedData: linkTarget.selectedData,
            rowCnt: linkTarget.rowCnt,
            colCnt: linkTarget.colCnt,
        })
    }

    // "Convert to block" (the LogiSheets analogue of Excel's Ctrl+T): infer a
    // schema from the selected region — field names from a header row, types
    // from the data (see block-composer/infer) — then open the composer in
    // convert mode pre-filled. The user confirms/edits before it's created.
    const convertToBlock = async (ctx: ContextMenuContext) => {
        close()
        await convertSelection(ctx.selectedData)
    }

    const convertSelection = async (selectedData: SelectedData) => {
        const result = await inferBlockFromSelection(dataSvc, selectedData)
        if ('error' in result) {
            toast(String(t(result.error)), {type: 'info'})
            return
        }
        setConvertComposer({
            selectedData: result.selectedData,
            rowCnt: result.convertRegion.rowCnt,
            colCnt: result.convertRegion.colCnt,
            initialFields: result.initialFields,
        })
    }

    // Edit an existing form block the click landed in: open the composer in
    // edit mode. v1 allows renaming the block and appending fields (existing
    // fields are read-only). `editCandidate` was resolved on menu-open.
    const openEditBlock = () => {
        close()
        if (!editCandidate) return
        setEditComposer(editCandidate)
    }

    // Insert an image into the clicked cell. Opens a native file picker, reads
    // the file as base64 and dispatches a `SetCellImage` payload. The image
    // fills the cell and resizes with it.
    const insertImage = (ctx: ContextMenuContext) => {
        close()
        const range = getSelectedCellRange(ctx.selectedData)
        if (!range) return
        const sheetIdx = getActiveSheet()
        const {startRow: row, startCol: col} = range
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/png,image/jpeg,image/gif,image/bmp'
        input.onchange = () => {
            const file = input.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
                const result = String(reader.result ?? '')
                const comma = result.indexOf(',')
                if (comma < 0) return
                const data = result.slice(comma + 1)
                let format = 'png'
                const m = /^data:image\/([a-z0-9.+-]+);/i.exec(result)
                if (m) format = m[1].toLowerCase()
                else {
                    const dot = file.name.lastIndexOf('.')
                    if (dot >= 0)
                        format = file.name.slice(dot + 1).toLowerCase()
                }
                const imageId =
                    typeof crypto !== 'undefined' && crypto.randomUUID
                        ? crypto.randomUUID()
                        : `img-${Date.now()}-${Math.round(Math.random() * 1e9)}`
                doTxn([
                    {
                        type: 'setCellImage',
                        value: {sheetIdx, row, col, imageId, format, data},
                    } as Payload,
                ])
            }
            reader.readAsDataURL(file)
        }
        input.click()
    }

    const removeImage = (ctx: ContextMenuContext) => {
        close()
        const range = getSelectedCellRange(ctx.selectedData)
        if (!range) return
        doTxn([
            {
                type: 'deleteCellImage',
                value: {
                    sheetIdx: getActiveSheet(),
                    row: range.startRow,
                    col: range.startCol,
                },
            } as Payload,
        ])
    }

    // Keyboard twins of the items above (Ctrl/⌘+1, Alt+=, Ctrl+T, Ctrl+9/0
    // and their Shift unhides). The grid reports the key with the selection
    // it applies to; the work is the same as the menu item's. Read through a
    // ref so the one subscription always reaches this render's closures.
    const onShortcut = async ({
        id,
        selectedData,
    }: SessionEventMap['shortcutIntent']) => {
        if (id in SHORTCUT_NUM_FMTS) {
            const code =
                id === 'numFmtCurrency' && i18n.language.startsWith('zh')
                    ? '"¥"#,##0.00'
                    : SHORTCUT_NUM_FMTS[id as keyof typeof SHORTCUT_NUM_FMTS]
            await ops.setNumFmt(getActiveSheet(), selectedData, code)
            return
        }
        switch (id) {
            case 'save':
                globalStore.requestSave()
                return
            case 'replace':
                globalStore.requestFind(true)
                return
            case 'toggleFormulas':
                globalStore.setShowFormulas(!globalStore.showFormulas)
                return
            case 'addComment': {
                const r = getSelectedCellRange(selectedData)
                if (!r) return
                globalStore.requestAddComment({
                    sheetIdx: getActiveSheet(),
                    row: r.startRow,
                    col: r.startCol,
                })
                return
            }
            case 'formatCells':
                openFormatFor(selectedData)
                return
            case 'convertToBlock':
                await convertSelection(selectedData)
                return
            case 'autoSum': {
                const r = getSelectedCellRange(selectedData)
                if (!r) return
                const p = await autoSumPayload(
                    dataSvc,
                    getActiveSheet(),
                    r.startRow,
                    r.startCol
                )
                if (p) await doTxn([p])
                return
            }
            case 'hideRows':
            case 'hideColumns':
            case 'unhideRows':
            case 'unhideColumns': {
                const axis = id.endsWith('Rows') ? 'row' : 'col'
                const span = linesAlong(selectedData, axis)
                if (span)
                    await setRangeHidden(axis, ...span, !id.startsWith('un'))
                return
            }
        }
    }
    const onShortcutRef = useRef(onShortcut)
    onShortcutRef.current = onShortcut
    useEffect(
        () => subscribeShortcut?.((e) => void onShortcutRef.current(e)),
        [subscribeShortcut]
    )

    const ctx = menu?.context
    const items: ReactNode = !ctx
        ? null
        : ctx.target === 'cell'
          ? [
                <ContextMenuItem
                    key="format"
                    icon={<TuneOutlinedIcon />}
                    onClick={() => openFormat(ctx)}
                >
                    {t('ui.menu.formatCells')}
                </ContextMenuItem>,
                <ContextMenuItem
                    key="clear"
                    icon={<BackspaceOutlinedIcon />}
                    onClick={() => clearCells(ctx)}
                >
                    {t('ui.menu.clearCells')}
                </ContextMenuItem>,
                <ContextMenuItem
                    key="comment"
                    icon={<AddCommentOutlinedIcon />}
                    onClick={() => addComment(ctx)}
                >
                    {t('ui.menu.addComment')}
                </ContextMenuItem>,
                ...(menuLink?.link
                    ? [
                          <ContextMenuItem
                              key="open-hyperlink"
                              icon={<OpenInNewOutlinedIcon />}
                              onClick={() => {
                                  close()
                                  void followLink(menuLink.target)
                              }}
                          >
                              {t('ui.menu.openLink')}
                          </ContextMenuItem>,
                      ]
                    : []),
                ...(menuLink
                    ? [
                          <ContextMenuItem
                              key="edit-hyperlink"
                              icon={<AddLinkOutlinedIcon />}
                              onClick={() => {
                                  close()
                                  setLinkDialog(menuLink.target)
                              }}
                          >
                              {menuLink.link
                                  ? t('ui.menu.editLink')
                                  : t('ui.menu.insertLink')}
                          </ContextMenuItem>,
                      ]
                    : []),
                ...(menuLink?.link && !menuLink.link.fromFormula
                    ? [
                          <ContextMenuItem
                              key="remove-hyperlink"
                              icon={<LinkOffOutlinedIcon />}
                              onClick={() => {
                                  close()
                                  const {sheetIdx, row, col} = menuLink.target
                                  void doTxn([
                                      {
                                          type: 'removeHyperlink',
                                          value: {sheetIdx, row, col},
                                      },
                                      {
                                          type: 'cellStyleUpdate',
                                          value: {
                                              sheetIdx,
                                              row,
                                              col,
                                              ty: {
                                                  setFontColor: 'FF000000',
                                                  setFontUnderline: 'none',
                                              },
                                          },
                                      },
                                  ])
                              }}
                          >
                              {t('ui.menu.removeLink')}
                          </ContextMenuItem>,
                      ]
                    : []),
                <ContextMenuItem
                    key="link"
                    icon={<LinkOutlinedIcon />}
                    onClick={() => openLink(ctx)}
                >
                    {t('ui.menu.linkToBlock')}
                </ContextMenuItem>,
                <ContextMenuItem
                    key="convert-block"
                    icon={<GridOnOutlinedIcon />}
                    onClick={() => convertToBlock(ctx)}
                >
                    {t('ui.menu.convertToBlock')}
                </ContextMenuItem>,
                <ContextMenuItem
                    key="conditional-formatting"
                    icon={<PaletteOutlinedIcon />}
                    onClick={() => openConditionalFormatting(ctx)}
                >
                    {t('ui.menu.conditionalFormatting')}
                </ContextMenuItem>,
                <ContextMenuItem
                    key="data-validation"
                    icon={<RuleOutlinedIcon />}
                    onClick={() => openDataValidation(ctx)}
                >
                    {t('ui.menu.dataValidation')}
                </ContextMenuItem>,
                ...(editCandidate
                    ? [
                          <ContextMenuItem
                              key="edit-block"
                              icon={<EditOutlinedIcon />}
                              onClick={openEditBlock}
                          >
                              {t('ui.menu.editBlock')}
                          </ContextMenuItem>,
                      ]
                    : []),
                <Divider key="traced" />,
                <ContextMenuItem
                    key="trace-prec"
                    icon={<NorthEastOutlinedIcon />}
                    onClick={() => traceCell(ctx, 'precedents')}
                >
                    {t('ui.menu.tracePrecedents')}
                </ContextMenuItem>,
                <ContextMenuItem
                    key="trace-dep"
                    icon={<SouthWestOutlinedIcon />}
                    onClick={() => traceCell(ctx, 'dependents')}
                >
                    {t('ui.menu.traceDependents')}
                </ContextMenuItem>,
                ...(globalStore.traceResult
                    ? [
                          <ContextMenuItem
                              key="trace-clear"
                              icon={<LayersClearOutlinedIcon />}
                              onClick={() => {
                                  close()
                                  globalStore.clearTrace()
                              }}
                          >
                              {t('ui.menu.clearTrace')}
                          </ContextMenuItem>,
                      ]
                    : []),
                <Divider key="imgd" />,
                <ContextMenuItem
                    key="insert-image"
                    icon={<ImageOutlinedIcon />}
                    onClick={() => insertImage(ctx)}
                >
                    {t('ui.menu.insertImage')}
                </ContextMenuItem>,
                <ContextMenuItem
                    key="remove-image"
                    icon={<HideImageOutlinedIcon />}
                    onClick={() => removeImage(ctx)}
                >
                    {t('ui.menu.removeImage')}
                </ContextMenuItem>,
            ]
          : ctx.target === 'row'
            ? [
                  <ContextMenuItem
                      key="ia"
                      icon={<AddOutlinedIcon />}
                      onClick={() => insertLines(ctx, 'row', 'before')}
                  >
                      {t('ui.menu.insertRowsAbove')}
                  </ContextMenuItem>,
                  <ContextMenuItem
                      key="ib"
                      icon={<AddOutlinedIcon />}
                      onClick={() => insertLines(ctx, 'row', 'after')}
                  >
                      {t('ui.menu.insertRowsBelow')}
                  </ContextMenuItem>,
                  <Box key="stepper">{stepper}</Box>,
                  <Divider key="d1" />,
                  <ContextMenuItem
                      key="fmt"
                      icon={<TuneOutlinedIcon />}
                      onClick={() => openFormat(ctx)}
                  >
                      {t('ui.menu.formatCellsShort')}
                  </ContextMenuItem>,
                  <ContextMenuItem
                      key="hide"
                      icon={<VisibilityOffOutlinedIcon />}
                      onClick={() => setLinesHidden(ctx, 'row', true)}
                  >
                      {t('ui.menu.hideRows')}
                  </ContextMenuItem>,
                  <ContextMenuItem
                      key="unhide"
                      icon={<VisibilityOutlinedIcon />}
                      onClick={() => setLinesHidden(ctx, 'row', false)}
                  >
                      {t('ui.menu.unhideRows')}
                  </ContextMenuItem>,
                  <Divider key="d2" />,
                  <ContextMenuItem
                      key="del"
                      icon={<DeleteOutlinedIcon />}
                      danger
                      onClick={() => deleteLines(ctx, 'row')}
                  >
                      {t('ui.menu.deleteRows')}
                  </ContextMenuItem>,
              ]
            : [
                  <ContextMenuItem
                      key="il"
                      icon={<AddOutlinedIcon />}
                      onClick={() => insertLines(ctx, 'col', 'before')}
                  >
                      {t('ui.menu.insertColsLeft')}
                  </ContextMenuItem>,
                  <ContextMenuItem
                      key="ir"
                      icon={<AddOutlinedIcon />}
                      onClick={() => insertLines(ctx, 'col', 'after')}
                  >
                      {t('ui.menu.insertColsRight')}
                  </ContextMenuItem>,
                  <Box key="stepper">{stepper}</Box>,
                  <Divider key="d1" />,
                  <ContextMenuItem
                      key="fmt"
                      icon={<TuneOutlinedIcon />}
                      onClick={() => openFormat(ctx)}
                  >
                      {t('ui.menu.formatCellsShort')}
                  </ContextMenuItem>,
                  <ContextMenuItem
                      key="hide"
                      icon={<VisibilityOffOutlinedIcon />}
                      onClick={() => setLinesHidden(ctx, 'col', true)}
                  >
                      {t('ui.menu.hideCols')}
                  </ContextMenuItem>,
                  <ContextMenuItem
                      key="unhide"
                      icon={<VisibilityOutlinedIcon />}
                      onClick={() => setLinesHidden(ctx, 'col', false)}
                  >
                      {t('ui.menu.unhideCols')}
                  </ContextMenuItem>,
                  <Divider key="d2" />,
                  <ContextMenuItem
                      key="del"
                      icon={<DeleteOutlinedIcon />}
                      danger
                      onClick={() => deleteLines(ctx, 'col')}
                  >
                      {t('ui.menu.deleteCols')}
                  </ContextMenuItem>,
              ]

    return (
        <>
            <ContextMenu
                open={!!menu}
                onClose={close}
                anchorReference="anchorPosition"
                anchorPosition={menu ? {top: menu.y, left: menu.x} : undefined}
            >
                {items}
            </ContextMenu>

            <Dialog
                open={!!cfRange}
                onClose={() => setCfRange(null)}
                keepMounted
                disableScrollLock
                disableAutoFocus
                disableEnforceFocus
                disableRestoreFocus
                PaperProps={{sx: {zIndex: 2000, p: 0}}}
            >
                {cfRange && (
                    <ConditionalFormattingDialog
                        dataSvc={dataSvc}
                        sheetIdx={cfRange.sheetIdx}
                        range={cfRange}
                        onClose={() => setCfRange(null)}
                    />
                )}
            </Dialog>

            <Dialog
                open={!!dvRange}
                onClose={() => setDvRange(null)}
                disableScrollLock
                disableRestoreFocus
                PaperProps={{sx: {zIndex: 2000, p: 0}}}
            >
                {dvRange && (
                    <DataValidationDialog
                        dataSvc={dataSvc}
                        sheetIdx={dvRange.sheetIdx}
                        range={dvRange}
                        onClose={() => setDvRange(null)}
                    />
                )}
            </Dialog>

            <Dialog
                open={fmtOpen && !!fmtSelectedData}
                onClose={() => setFmtOpen(false)}
                maxWidth="md"
                fullWidth
                keepMounted
                disableScrollLock
                disableAutoFocus
                disableEnforceFocus
                disableRestoreFocus
                PaperProps={{sx: {zIndex: 2000, p: 0}}}
            >
                {fmtSelectedData && (
                    <FormatDialogContent
                        value={fmtValue}
                        onChange={(v) => setFmtValue(v)}
                        onCancel={() => setFmtOpen(false)}
                        selectedData={fmtSelectedData}
                    />
                )}
            </Dialog>

            <Dialog
                open={linkOpen}
                onClose={() => setLinkOpen(false)}
                disableScrollLock
                PaperProps={{sx: {zIndex: 2000, minWidth: 320, p: 2}}}
            >
                <Box sx={{fontWeight: 600, fontSize: 15, mb: 1}}>
                    {t('ui.menu.linkToBlockTitle')}
                </Box>
                <Box sx={{fontSize: 12.5, color: '#667', mb: 1.5}}>
                    {linkTarget
                        ? `The selected range (${linkTarget.colCnt} column${
                              linkTarget.colCnt > 1 ? 's' : ''
                          }) will read from the block you pick — which can grow.`
                        : ''}
                </Box>
                <MenuItem
                    onClick={createNewBlock}
                    sx={{borderRadius: 1, fontWeight: 600, color: '#2563eb'}}
                >
                    ＋ Create a new block from selection
                </MenuItem>
                {linkBlocks.length > 0 && (
                    <Divider sx={{my: 0.5}}>
                        {t('ui.menu.orLinkExisting')}
                    </Divider>
                )}
                {linkBlocks.map((b) => (
                    <MenuItem
                        key={b.blockId}
                        onClick={() => pickBlock(b.blockId)}
                        sx={{borderRadius: 1}}
                    >
                        {`Block #${b.blockId} · ${b.rowCnt}×${b.colCnt}${
                            b.schema?.name ? ` · ${b.schema.name}` : ''
                        }`}
                    </MenuItem>
                ))}
            </Dialog>

            {convertComposer && (
                <BlockComposerComponent
                    selectedData={convertComposer.selectedData}
                    convertRegion={{
                        rowCnt: convertComposer.rowCnt,
                        colCnt: convertComposer.colCnt,
                    }}
                    initialFields={convertComposer.initialFields}
                    close={() => setConvertComposer(null)}
                />
            )}

            {editComposer && (
                <BlockComposerComponent
                    editTarget={editComposer}
                    close={() => setEditComposer(null)}
                />
            )}

            <HyperlinkDialog
                dataSvc={dataSvc}
                target={linkDialog}
                onClose={() => setLinkDialog(null)}
            />
        </>
    )
}

const stepBtnStyle: React.CSSProperties = {
    width: 24,
    height: 24,
    border: 'none',
    background: '#f5f5f5',
    cursor: 'pointer',
    fontSize: 14,
    lineHeight: 1,
}

const stepInputStyle: React.CSSProperties = {
    width: 44,
    height: 24,
    border: 'none',
    borderLeft: '1px solid #d0d0d0',
    borderRight: '1px solid #d0d0d0',
    textAlign: 'center',
    fontSize: 12,
    MozAppearance: 'textfield',
}
