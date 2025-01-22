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
    Transaction,
    isErrorMessage,
    BlockInfo,
} from 'logisheets-web'
import {TYPES} from '@/core/ioc/types'
import {DataService} from '@/core/data'

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
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    let selectBlock: ReactElement | undefined
    const _blockProcess = (
        blocks: readonly BlockInfo[],
        cb: (blks: readonly BlockInfo[]) => Payload[]
    ) => {
        const close$ = (blks: readonly BlockInfo[]) => {
            setIsOpen(false)
            setBlockMenuOpened(false)
            DATA_SERVICE.handleTransaction(new Transaction(cb(blks), true))
        }
        selectBlock = (
            <div>
                <SelectBlockComponent
                    message={getMessage(blocks)}
                    blocks={blocks}
                    close$={close$}
                />
            </div>
        )
        setBlockMenuOpened(true)
    }
    const _addCol = async () => {
        const sheet = DATA_SERVICE.getCurrentSheetIdx()
        const {
            coordinate: {startCol: start},
        } = startCell
        const blocks = await _checkBlock()
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
        DATA_SERVICE.handleTransaction(new Transaction([payload], true))
    }

    const _removeCol = async () => {
        const {
            coordinate: {startCol: start},
        } = startCell
        const sheet = DATA_SERVICE.getCurrentSheetIdx()
        const blocks = await _checkBlock()
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
        DATA_SERVICE.handleTransaction(new Transaction([payload], true))
    }

    const _addRow = async () => {
        const {
            coordinate: {startRow: start},
        } = startCell
        const sheet = DATA_SERVICE.getCurrentSheetIdx()
        const blocks = await _checkBlock()
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
        DATA_SERVICE.handleTransaction(new Transaction([payload], true))
    }

    const _removeRow = async () => {
        const {
            coordinate: {startRow: start},
        } = startCell
        const sheet = DATA_SERVICE.getCurrentSheetIdx()
        const blocks = await _checkBlock()
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
        DATA_SERVICE.handleTransaction(new Transaction([payload], true))
    }

    const _addBlock = async () => {
        const endCellTruthy = endCell ?? startCell
        const start = startCell.coordinate
        const end = endCellTruthy.coordinate
        const payload = new CreateBlockBuilder()
            .blockId(1)
            .sheetIdx(DATA_SERVICE.getCurrentSheetIdx())
            .rowCnt(Math.abs(end.endRow - start.startRow) + 1)
            .colCnt(Math.abs(end.endCol - start.startCol) + 1)
            .masterRow(Math.min(start.startRow, end.startRow))
            .masterCol(Math.min(start.startCol, end.startCol))
            .build()
        DATA_SERVICE.handleTransaction(new Transaction([payload], true))
    }

    const _checkBlock = async () => {
        const {coordinate: start} = startCell
        const {coordinate: end} = endCell ?? startCell
        const result = await DATA_SERVICE.getFullyCoveredBlocks(
            DATA_SERVICE.getCurrentSheetIdx(),
            start.startRow,
            start.startCol,
            end.endRow - start.startRow + 1,
            end.endCol - start.startCol + 1
        )
        if (isErrorMessage(result)) {
            return []
        }
        return result
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
                ariaHideApp={false}
                style={{
                    content: {
                        height: 'fit-content',
                        width: '200px',
                        padding: '8px 0',
                    },
                }}
            />
            {blockMenuOpened ? selectBlock : null}
        </div>
    )
}

const getMessage = (blocks: readonly BlockInfo[]) => {
    return blocks.length === 1
        ? '当前选择范围属于一个block，是否继续？'
        : '选择一个block'
}
