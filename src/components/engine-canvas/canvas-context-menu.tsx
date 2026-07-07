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

import {useState, useEffect, useCallback, type ReactNode} from 'react'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import type {
    ContextMenuContext,
    SelectedData,
    Transaction,
    Payload,
    DataService,
} from 'logisheets-engine'
import {
    isErrorMessage,
    getSelectedCellRange,
    getSelectedLines,
} from 'logisheets-engine'
import FormatDialogContent, {
    type FormatDialogValue,
} from '@/components/format-dialog'
import {globalStore} from '@/store'

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
        return [Math.min(lines.start, lines.end), Math.max(lines.start, lines.end)]
    const idx = (ctx.target === 'row' ? ctx.row : ctx.col) ?? 0
    return [idx, idx]
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
}

export function CanvasContextMenu({
    subscribe,
    dataSvc,
    getActiveSheet,
    setSelection,
}: CanvasContextMenuProps): ReactNode {
    const [menu, setMenu] = useState<{x: number; y: number; context: ContextMenuContext} | null>(
        null
    )
    const [count, setCount] = useState(1)
    const [fmtOpen, setFmtOpen] = useState(false)
    const [fmtSelectedData, setFmtSelectedData] = useState<SelectedData | null>(null)
    const [fmtValue, setFmtValue] = useState<FormatDialogValue>({})

    useEffect(() => {
        return subscribe((e) => {
            setMenu({x: e.x, y: e.y, context: e.context})
            setCount(selectedLineCount(e.context))
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

    const openFormat = (ctx: ContextMenuContext) => {
        setFmtSelectedData(ctx.selectedData)
        setFmtValue({})
        setFmtOpen(true)
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
                payloads.push({type: 'cellClear', value: {sheetIdx, row: r, col: c}})
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
        const r = await doTxn([{type, value: {sheetIdx, start, count}} as Payload])
        if (isErrorMessage(r)) return
        if (where === 'before') {
            setSelection(lineSelection(lo + count, hi + count, axis))
        } else {
            setSelection(lineSelection(lo, hi, axis))
        }
    }

    const deleteLines = async (ctx: ContextMenuContext, axis: 'row' | 'col') => {
        close()
        const sheetIdx = getActiveSheet()
        const [lo, hi] = selectedLineRange(ctx)
        const type = axis === 'row' ? 'deleteRows' : 'deleteCols'
        const r = await doTxn([
            {type, value: {sheetIdx, start: lo, count: hi - lo + 1}} as Payload,
        ])
        if (!isErrorMessage(r)) setSelection({source: 'none'})
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
            <span style={{flex: 1}}>Count</span>
            <Box sx={{display: 'flex', alignItems: 'center', border: '1px solid #d0d0d0', borderRadius: 1, overflow: 'hidden'}}>
                <button
                    type="button"
                    aria-label="decrease"
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
                        setCount(Number.isNaN(v) ? 1 : Math.min(1000, Math.max(1, v)))
                    }}
                    style={stepInputStyle}
                />
                <button
                    type="button"
                    aria-label="increase"
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
                    if (dot >= 0) format = file.name.slice(dot + 1).toLowerCase()
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

    const ctx = menu?.context
    const items: ReactNode = !ctx ? null : ctx.target === 'cell' ? (
        [
            <MenuItem key="format" onClick={() => openFormat(ctx)}>
                Format Cells
            </MenuItem>,
            <MenuItem key="clear" onClick={() => clearCells(ctx)}>
                Clear Cells
            </MenuItem>,
            <MenuItem key="comment" onClick={() => addComment(ctx)}>
                Add comment
            </MenuItem>,
            <Divider key="imgd" />,
            <MenuItem key="insert-image" onClick={() => insertImage(ctx)}>
                Insert image
            </MenuItem>,
            <MenuItem key="remove-image" onClick={() => removeImage(ctx)}>
                Remove image
            </MenuItem>,
        ]
    ) : ctx.target === 'row' ? (
        [
            <MenuItem key="ia" onClick={() => insertLines(ctx, 'row', 'before')}>
                Insert rows above
            </MenuItem>,
            <MenuItem key="ib" onClick={() => insertLines(ctx, 'row', 'after')}>
                Insert rows below
            </MenuItem>,
            <Box key="stepper">{stepper}</Box>,
            <Divider key="d1" />,
            <MenuItem key="fmt" onClick={() => openFormat(ctx)}>
                Format cells
            </MenuItem>,
            <Divider key="d2" />,
            <MenuItem key="del" onClick={() => deleteLines(ctx, 'row')}>
                Delete rows
            </MenuItem>,
        ]
    ) : (
        [
            <MenuItem key="il" onClick={() => insertLines(ctx, 'col', 'before')}>
                Insert columns left
            </MenuItem>,
            <MenuItem key="ir" onClick={() => insertLines(ctx, 'col', 'after')}>
                Insert columns right
            </MenuItem>,
            <Box key="stepper">{stepper}</Box>,
            <Divider key="d1" />,
            <MenuItem key="fmt" onClick={() => openFormat(ctx)}>
                Format cells
            </MenuItem>,
            <Divider key="d2" />,
            <MenuItem key="del" onClick={() => deleteLines(ctx, 'col')}>
                Delete columns
            </MenuItem>,
        ]
    )

    return (
        <>
            <Menu
                open={!!menu}
                onClose={close}
                anchorReference="anchorPosition"
                anchorPosition={menu ? {top: menu.y, left: menu.x} : undefined}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
                disableScrollLock
                MenuListProps={{autoFocusItem: false, sx: {minWidth: 200, py: 0.5}}}
            >
                {items}
            </Menu>

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
                container={document.body}
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
