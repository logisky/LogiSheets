import {
    ColumnShift,
    CreateBlock,
    LineShiftInBlock,
    Payload,
    RowShift,
    ShiftType,
} from 'proto/message'
import { Range, StandardBlock } from 'core/standable'
import { SelectBlockComponent } from './select-block'
import { Cell } from './defs'
import { useState, ReactElement, MouseEvent } from 'react'
import { DATA_SERVICE } from 'core/data'
import { ContextMenuComponent, ContextMenuItem } from 'ui/contextmenu'

export interface ContextmenuProps {
    mouseevent: MouseEvent
    startCell: Cell
    endCell?: Cell
    isOpen: boolean
    setIsOpen: (isOpen: boolean) => void
}

export const ContextmenuComponent = (props: ContextmenuProps) => {
    const { mouseevent, startCell, isOpen, setIsOpen, endCell } = props
    const [blockMenuOpened, setBlockMenuOpened] = useState(false)
    let selectBlock: ReactElement | undefined
    const _blockProcess = (
        blocks: readonly StandardBlock[],
        cb: (blks: readonly StandardBlock[]) => Payload[],
    ) => {
        const close$ = (blks: readonly StandardBlock[]) => {
            setIsOpen(false)
            setBlockMenuOpened(false)
            DATA_SERVICE.backend.sendTransaction(cb(blks))
        }
        selectBlock = (
            <div>
                <SelectBlockComponent
                    message={getMessage(blocks)}
                    blocks={blocks}
                    close$={close$}
                ></SelectBlockComponent>
            </div>
        )
        setBlockMenuOpened(true)
    }
    const _addCol = () => {
        const sheet = DATA_SERVICE.sheetSvc.getActiveSheet()
        const { coodinate: { startCol: start } } = startCell
        const blocks = _checkBlock()
        if (blocks.length !== 0) {
            _blockProcess(
                blocks,
                blks => blks.map((block): Payload => {
                    const shift: LineShiftInBlock = {
                        cnt: 1,
                        horizontal: false,
                        id: block.blockId,
                        idx: start - block.colStart,
                        insert: true,
                        sheetIdx: sheet,
                    }
                    return {
                        payloadOneof: {
                            $case: 'lineShiftInBlock',
                            lineShiftInBlock: shift
                        }
                    }
                })
            )
            setBlockMenuOpened(true)
            return
        }
        const columnShift: ColumnShift = {
            sheetIdx: sheet,
            count: 1,
            start: start,
            type: ShiftType.INSERT,
        }
        const payload: Payload = { payloadOneof: { columnShift, $case: 'columnShift' } }
        DATA_SERVICE.backend.sendTransaction([payload])
    }

    const _removeCol = () => {
        const { coodinate: { startCol: start } } = startCell
        const sheet = DATA_SERVICE.sheetSvc.getActiveSheet()
        const blocks = _checkBlock()
        if (blocks.length !== 0) {
            _blockProcess(
                blocks,
                blks => blks.map((block): Payload => {
                    const lineShiftInBlock: LineShiftInBlock = {
                        cnt: 1,
                        horizontal: false,
                        id: block.blockId,
                        idx: start - block.colStart,
                        insert: false,
                        sheetIdx: sheet,
                    }
                    return {
                        payloadOneof: {
                            $case: 'lineShiftInBlock',
                            lineShiftInBlock,
                        }
                    }
                })
            )
            setBlockMenuOpened(true)
            return
        }
        const columnShift: ColumnShift = {
            sheetIdx: sheet,
            count: 1,
            start: start,
            type: ShiftType.DELETE,
        }
        const payload: Payload = {
            payloadOneof: {
                $case: 'columnShift',
                columnShift,
            }
        }
        DATA_SERVICE.backend.sendTransaction([payload])
    }

    const _addRow = () => {
        const { coodinate: { startRow: start } } = startCell
        const sheet = DATA_SERVICE.sheetSvc.getActiveSheet()
        const blocks = _checkBlock()
        if (blocks.length !== 0) {
            _blockProcess(
                blocks,
                blks => blks.map((block): Payload => {
                    const lineShiftInBlock: LineShiftInBlock = {
                        cnt: 1,
                        horizontal: true,
                        id: block.blockId,
                        idx: start - block.rowStart,
                        insert: true,
                        sheetIdx: sheet,
                    }
                    return {
                        payloadOneof: {
                            lineShiftInBlock,
                            $case: 'lineShiftInBlock',
                        }
                    }
                })
            )
            return
        }
        const rowShift: RowShift = {
            sheetIdx: sheet,
            count: 1,
            start: start,
            type: ShiftType.INSERT,
        }
        const payload: Payload = {
            payloadOneof: {
                $case: 'rowShift',
                rowShift,
            }
        }
        DATA_SERVICE.backend.sendTransaction([payload])
    }

    const _removeRow = () => {
        const { coodinate: { startRow: start } } = startCell
        const sheet = DATA_SERVICE.sheetSvc.getActiveSheet()
        const blocks = _checkBlock()
        if (blocks.length !== 0) {
            _blockProcess(
                blocks,
                blks => blks.map((block): Payload => {
                    const lineShiftInBlock: LineShiftInBlock = {
                        cnt: 1,
                        horizontal: true,
                        id: block.blockId,
                        idx: start - block.rowStart,
                        insert: false,
                        sheetIdx: sheet,
                    }
                    return {
                        payloadOneof: {
                            $case: 'lineShiftInBlock',
                            lineShiftInBlock,
                        }
                    }
                })
            )
            return
        }
        const rowShift: RowShift = {
            sheetIdx: sheet,
            count: 1,
            start: start,
            type: ShiftType.DELETE,
        }
        const payload: Payload = {
            payloadOneof: {
                $case: 'rowShift',
                rowShift,
            }
        }
        DATA_SERVICE.backend.sendTransaction([payload])
    }

    const _addBlock = () => {
        const endCellTruthy = endCell ?? startCell
        const start = startCell.coodinate
        const end = endCellTruthy.coodinate
        const createBlock: CreateBlock = {
            id: 0,
            sheetIdx: DATA_SERVICE.sheetSvc.getActiveSheet(),
            colCnt: Math.abs(end.endCol - start.startCol) + 1,
            rowCnt: Math.abs(end.endRow - start.startRow) + 1,
            masterCol: Math.min(start.startCol, end.startCol),
            masterRow: Math.min(start.startRow, end.startRow),
        }
        const payload: Payload = {
            payloadOneof: {
                $case: 'createBlock',
                createBlock,
            }
        }
        DATA_SERVICE.backend.sendTransaction([payload])
    }

    const _checkBlock = () => {
        const { coodinate: start } = startCell
        const { coodinate: end } = endCell ?? startCell
        const curr = new Range()
        curr.startRow = start.startRow
        curr.endRow = end.endRow
        curr.startCol = start.startCol
        curr.endCol = end.endCol
        const blocks = DATA_SERVICE.sheetSvc.getBlocks()
        return blocks.filter(b => b.coordinate.cover(curr))
    }

    const rows: ContextMenuItem[] = [
        {
            text: '增加行',
            type: 'text',
            click: _addRow,
        },
        {
            text: '删除行',
            type: 'text',
            click: _removeRow,
        },
    ]
    const cols: readonly ContextMenuItem[] = [
        {
            text: '增加列',
            type: 'text',
            click: _addCol,
        },
        {
            text: '删除列',
            type: 'text',
            click: _removeCol,
        }
    ]
    const items: ContextMenuItem[] = []
    if (startCell.type === 'FixedLeftHeader')
        items.push(...rows)
    else if (startCell.type === 'FixedTopHeader')
        items.push(...cols)
    else if (startCell.type === 'Cell') {
        items.push(...rows, ...cols)
        items.push({
            text: '新增block',
            type: 'text',
            click: _addBlock,
        })
    }
    return (
        <div>
            <ContextMenuComponent
                isOpen={isOpen}
                items={items}
                close$={() => setIsOpen(false)}
                mouseevent={mouseevent}
                style={{ content: { height: 'fit-content', width: '200px', padding: '8px 0' } }}
            ></ContextMenuComponent>
            {blockMenuOpened ? selectBlock : null}
        </div>
    )
}

const getMessage = (blocks: readonly StandardBlock[]) => {
    return blocks.length === 1 ? '当前选择范围属于一个block，是否继续？' : '选择一个block'
}