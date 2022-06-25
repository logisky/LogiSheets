import { Transaction, PayloadsTransaction, UndoTransaction, RedoTransaction } from '../transactions'
import { EditAction, EditPayload, StyleUpdateType } from '@/bindings'
import { Payload, SetFont, SetBorder } from "../payloads";

export function adaptTransaction(t: Transaction): EditAction {
    if (t instanceof UndoTransaction)
        return 'Undo'
    if (t instanceof RedoTransaction) {
        return 'Redo'
    }
    if (t instanceof PayloadsTransaction) {
        const transaction = t
        const payloads: EditPayload[] = []
        transaction.payloads.forEach(p => {
            payloads.push(adaptPayload(p))
        })
        return {Payloads: {payloads , undoable: true}}
    }
    throw Error('unknown transaction type!')
}

export function adaptPayload(p: Payload): EditPayload {
    switch (p.type) {
    case 'sheetRename':
        return {
            SheetRename: {oldName: p.oldName, newName: p.newName}
        }
    case 'cellInput':
        return {
            CellInput: {sheetIdx: p.sheetIdx, row: p.row, col: p.col, content: p.input}
        }
    case 'insertRows':
        return {
            RowShift: {insert: true, row: p.start, count: p.cnt, sheetIdx: p.sheetIdx}
        }
    case 'deleteRows':
        return {
            RowShift: {insert: false, row: p.start, count: p.cnt, sheetIdx: p.sheetIdx}
        }
    case 'insertCols':
        return {
            ColShift: {insert: true, col: p.start, count: p.cnt, sheetIdx: p.sheetIdx}
        }
    case 'deleteCols':
        return {
            ColShift: {insert: false, col: p.start, count: p.cnt, sheetIdx: p.sheetIdx}
        }
    case 'createBlock':
        return {
            CreateBlock: {
                sheetIdx: p.sheetIdx,
                masterRow: p.masterRow,
                masterCol: p.masterCol,
                colCnt: p.colCnt,
                rowCnt: p.rowCnt,
                id: p.blockId,
            }
        }
    case 'moveBlock':
        return {
            MoveBlock: {
                sheetIdx: p.sheetIdx,
                id: p.blockId,
                newMasterRow: p.newMasterRow,
                newMasterCol: p.newMasterCol,
            }
        }
    case 'setColWidth':
        return {
            SetColWidth: {sheetIdx: p.sheetIdx, col: p.col, width: p.width}
        }
    case 'setRowHeight':
        return {
            SetRowHeight: {sheetIdx: p.sheetIdx, row: p.row, height: p.height}
        }
    case 'setRowVisible':
        return {
           SetVisible: {
               isRow: true,
               sheetIdx: p.sheetIdx,
               visible: p.visible,
               start: p.row,
            } 
        }
    case 'setColVisible':
        return {
           SetVisible: {
               isRow: false,
               sheetIdx: p.sheetIdx,
               visible: p.visible,
               start: p.col,
            } 
        }
    case 'insertBlockRows':
        return {
            LineShiftInBlock: {
                sheetIdx: p.sheetIdx,
                blockId: p.blockId,
                idx: p.rowIdx,
                cnt: p.cnt,
                insert: true,
                horizontal: true,
            }
        }
    case 'insertBlockCols':
        return {
            LineShiftInBlock: {
                sheetIdx: p.sheetIdx,
                blockId: p.blockId,
                idx: p.colIdx,
                cnt: p.cnt,
                insert: true,
                horizontal: true,
            }
        }
    case 'deleteBlockRows':
        return {
            LineShiftInBlock: {
                sheetIdx: p.sheetIdx,
                blockId: p.blockId,
                idx: p.rowIdx,
                cnt: p.cnt,
                insert: false,
                horizontal: true,
            }
        }
    case 'deleteBlockCols':
        return {
            LineShiftInBlock: {
                sheetIdx: p.sheetIdx,
                blockId: p.blockId,
                idx: p.colIdx,
                cnt: p.cnt,
                insert: false,
                horizontal: false,
            }
        }
    case 'setFont':
        return adapatSetFont(p)
    case 'setBorder':
        return adaptSetBorder(p)
    case 'deleteSheet':
    case 'insertSheet':
    default:
        throw Error(`unimplemented: ${p}`)
    }
}

function adapatSetFont(p: SetFont): EditPayload {
    const payload = initStyleUpdate()
    if (p.bold !== undefined)
        payload.setFontBold = p.bold
    if (p.italic !== undefined)
        payload.setFontItalic = p.italic
    if (p.underline !== undefined)
        payload.setFontUnderline = p.underline
    if (p.color !== undefined)
        payload.setFontColor = p.color
    if (p.size !== undefined)
        payload.setFontSize = p.size
    if (p.name !== undefined)
        payload.setFontName = p.name
    if (p.outline !== undefined)
        payload.setFontOutline = p.outline
    if (p.shadow !== undefined)
        payload.setFontShadow = p.shadow
    if (p.strike !== undefined)
        payload.setFontStrike = p.strike
    if (p.condense !== undefined)
        payload.setFontCondense = p.condense
    return {
        StyleUpdate: {sheetIdx: p.sheetIdx, row: p.row, col: p.col, ty: payload}
    }
}

function adaptSetBorder(p: SetBorder): EditPayload {
    const payload = initStyleUpdate()
    if (p.leftColor !== undefined)
        payload.setLeftBorderColor = p.leftColor
    if (p.rightColor !== undefined)
        payload.setRightBorderColor = p.rightColor
    if (p.topColor !== undefined)
        payload.setTopBorderColor = p.topColor
    if (p.bottomColor !== undefined)
        payload.setBottomBorderColor = p.bottomColor
    if (p.leftBorderType !== undefined)
        payload.setLeftBorderStyle  = p.leftBorderType
    if (p.rightBorderType !== undefined)
        payload.setRightBorderStyle = p.rightBorderType
    if (p.topBorderType !== undefined)
        payload.setTopBorderStyle = p.topBorderType
    if (p.bottomBorderType !== undefined)
        payload.setBottomBorderStyle = p.bottomBorderType
    if (p.diagonalUp !== undefined)
        payload.setBorderGiagonalUp = p.diagonalUp
    if (p.diagonalDown !== undefined)
        payload.setBorderGiagonalDown = p.diagonalDown
    return {
        StyleUpdate: {sheetIdx: p.sheetIdx, row: p.row, col: p.col, ty: payload}
    }
}

function initStyleUpdate(): StyleUpdateType {
    return {
        setBorderGiagonalDown: null,
        setBorderGiagonalUp: null,
        setBottomBorderColor: null,
        setBottomBorderStyle: null,
        setFontBold: null,
        setFontColor: null,
        setFontCondense: null,
        setFontItalic: null,
        setFontName: null,
        setFontOutline: null,
        setFontShadow: null,
        setFontSize: null,
        setFontStrike: null,
        setFontUnderline: null,
        setLeftBorderColor: null,
        setLeftBorderStyle: null,
        setPatternFill: null,
        setRightBorderColor: null,
        setRightBorderStyle: null,
        setTopBorderColor: null,
        setTopBorderStyle: null,
    }
}