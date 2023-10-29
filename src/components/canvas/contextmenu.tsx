import {Range, StandardBlock} from '@/core/standable'
import {SelectBlockComponent} from './select-block'
import {Cell} from './defs'
import {useState, ReactElement, MouseEvent} from 'react'
import {useInjection} from '@/core/ioc/provider'
import {ContextMenuComponent, ContextMenuItem} from '@/ui/contextmenu'
import {
    DeleteBlockColsBuilder,
    DeleteColsBuilder,
    InsertColsBuilder,
    Payload,
    InsertBlockColsBuilder,
    InsertBlockRowsBuilder,
    InsertRowsBuilder,
    DeleteBlockRowsBuilder,
    DeleteRowsBuilder,
    CreateBlockBuilder,
} from '@/api'
import {TYPES} from '@/core/ioc/types'
import {Backend, SheetService} from '@/core/data'

export interface ContextmenuProps {
    mouseevent: MouseEvent
    startCell: Cell
    endCell?: Cell
    isOpen: boolean
    setIsOpen: (isOpen: boolean) => void
}

export const ContextmenuComponent = (props: ContextmenuProps) => {
    const {mouseevent, startCell, isOpen, setIsOpen, endCell} = props
    const [blockMenuOpened, setBlockMenuOpened] = useState(false)
    const BACKEND_SERVICE = useInjection<Backend>(TYPES.Backend)
    const SHEET_SERVICE = useInjection<SheetService>(TYPES.Sheet)
    let selectBlock: ReactElement | undefined
    const _blockProcess = (
        blocks: readonly StandardBlock[],
        cb: (blks: readonly StandardBlock[]) => Payload[]
    ) => {
        const close$ = (blks: readonly StandardBlock[]) => {
            setIsOpen(false)
            setBlockMenuOpened(false)
            BACKEND_SERVICE.sendTransaction(cb(blks))
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
        const sheet = SHEET_SERVICE.getActiveSheet()
        const {
            coordinate: {startCol: start},
        } = startCell
        const blocks = _checkBlock()
        if (blocks.length !== 0) {
            _blockProcess(blocks, (blks) =>
                blks.map((block): Payload => {
                    return new InsertBlockColsBuilder()
                        .sheetIdx(sheet)
                        .blockId(block.blockId)
                        .colIdx(start - block.colStart)
                        .cnt(1)
                        .build() as Payload
                })
            )
            setBlockMenuOpened(true)
            return
        }
        const payload = new InsertColsBuilder()
            .sheetIdx(sheet)
            .start(start)
            .cnt(1)
            .build()
        BACKEND_SERVICE.sendTransaction([payload])
    }

    const _removeCol = () => {
        const {
            coordinate: {startCol: start},
        } = startCell
        const sheet = SHEET_SERVICE.getActiveSheet()
        const blocks = _checkBlock()
        if (blocks.length !== 0) {
            _blockProcess(blocks, (blks) =>
                blks.map((block): Payload => {
                    return new DeleteBlockColsBuilder()
                        .sheetIdx(sheet)
                        .blockId(block.blockId)
                        .cnt(1)
                        .colIdx(start - block.colStart)
                        .build() as Payload
                })
            )
            setBlockMenuOpened(true)
            return
        }
        const payload = new DeleteColsBuilder()
            .sheetIdx(sheet)
            .cnt(1)
            .start(start)
            .build()
        BACKEND_SERVICE.sendTransaction([payload])
    }

    const _addRow = () => {
        const {
            coordinate: {startRow: start},
        } = startCell
        const sheet = SHEET_SERVICE.getActiveSheet()
        const blocks = _checkBlock()
        if (blocks.length !== 0) {
            _blockProcess(blocks, (blks) =>
                blks.map((block): Payload => {
                    return new InsertBlockRowsBuilder()
                        .sheetIdx(sheet)
                        .rowIdx(start - block.rowStart)
                        .blockId(block.blockId)
                        .cnt(1)
                        .build()
                })
            )
            return
        }
        const payload = new InsertRowsBuilder()
            .sheetIdx(sheet)
            .start(start)
            .cnt(1)
            .build()
        BACKEND_SERVICE.sendTransaction([payload])
    }

    const _removeRow = () => {
        const {
            coordinate: {startRow: start},
        } = startCell
        const sheet = SHEET_SERVICE.getActiveSheet()
        const blocks = _checkBlock()
        if (blocks.length !== 0) {
            _blockProcess(blocks, (blks) =>
                blks.map((block): Payload => {
                    return new DeleteBlockRowsBuilder()
                        .sheetIdx(sheet)
                        .cnt(1)
                        .blockId(block.blockId)
                        .rowIdx(start - block.rowStart)
                        .build()
                })
            )
            return
        }
        const payload = new DeleteRowsBuilder()
            .sheetIdx(sheet)
            .cnt(1)
            .start(start)
            .build()
        BACKEND_SERVICE.sendTransaction([payload])
    }

    const _addBlock = () => {
        const endCellTruthy = endCell ?? startCell
        const start = startCell.coordinate
        const end = endCellTruthy.coordinate
        const payload = new CreateBlockBuilder()
            .blockId(1)
            .sheetIdx(SHEET_SERVICE.getActiveSheet())
            .rowCnt(Math.abs(end.endRow - start.startRow) + 1)
            .colCnt(Math.abs(end.endCol - start.startCol) + 1)
            .masterRow(Math.min(start.startRow, end.startRow))
            .masterCol(Math.min(start.startCol, end.startCol))
            .build()
        BACKEND_SERVICE.sendTransaction([payload])
    }

    const _checkBlock = () => {
        const {coordinate: start} = startCell
        const {coordinate: end} = endCell ?? startCell
        const curr = new Range()
            .setStartRow(start.startRow)
            .setStartCol(start.startCol)
            .setEndRow(end.endRow)
            .setEndCol(end.endCol)
        const blocks = SHEET_SERVICE.getBlocks()
        return blocks.filter((b) => b.coordinate.cover(curr))
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
        },
    ]
    const items: ContextMenuItem[] = []
    if (startCell.type === 'FixedLeftHeader') items.push(...rows)
    else if (startCell.type === 'FixedTopHeader') items.push(...cols)
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
                style={{
                    content: {
                        height: 'fit-content',
                        width: '200px',
                        padding: '8px 0',
                    },
                }}
            ></ContextMenuComponent>
            {blockMenuOpened ? selectBlock : null}
        </div>
    )
}

const getMessage = (blocks: readonly StandardBlock[]) => {
    return blocks.length === 1
        ? '当前选择范围属于一个block，是否继续？'
        : '选择一个block'
}
