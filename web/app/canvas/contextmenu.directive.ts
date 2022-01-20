import {Directive, OnInit, OnDestroy} from '@angular/core'
import {
    ContextMenuItem,
    ContextMenuItemBuilder,
    ContextMenuService,
} from '@logi-sheets/web/app/context-menu'
import {MatDialog} from '@angular/material/dialog'
import {
    RowShiftBuilder,
    ShiftTypeEnum,
    _Payload_Payload_oneof,
    TransactionBuilder,
    PayloadBuilder,
    Payload,
    CreateBlockBuilder,
    LineShiftInBlockBuilder,
    ColumnShiftBuilder,
} from '@logi-pb/network/src/proto/message_pb'
import {Subscription} from 'rxjs'
import {map} from 'rxjs/operators'
import {CanvasComponent} from './canvas.component'
import {RangeBuilder, StandardBlock} from '@logi-sheets/web/core/standable'
import {Data, SelectBlockComponent} from './select-block.component'

@Directive({selector: '[logi-canvas-contextmenu]'})
export class ContextmenuDirective extends Subscription
    implements OnInit, OnDestroy {
    constructor(
        private readonly _canvas: CanvasComponent,
        private readonly _contextmenuSvc: ContextMenuService,
        private readonly _dialog: MatDialog,
    ) {
        super()
    }
    ngOnInit() {
        this._init()
    }

    ngOnDestroy() {
        this.unsubscribe()
    }

    private _contextmenu(e: MouseEvent) {
        const rows = [
            new ContextMenuItemBuilder()
                .text('增加行')
                .type('text')
                .click(this._addRow)
                .build(),
            new ContextMenuItemBuilder()
                .text('删除行')
                .type('text')
                .click(this._removeRow)
                .build(),
        ]
        const cols = [
            new ContextMenuItemBuilder()
                .text('增加列')
                .type('text')
                .click(this._addCol)
                .build(),
            new ContextMenuItemBuilder()
                .text('删除列')
                .type('text')
                .click(this._removeCol)
                .build(),
        ]
        const matchCell = this._canvas.startCellMng.startCell
        const items: ContextMenuItem[] = []
        if (matchCell.type === 'FixedLeftHeader')
            items.push(...rows)
        else if (matchCell.type === 'FixedTopHeader')
            items.push(...cols)
        else if (matchCell.type === 'Cell') {
            items.push(...rows, ...cols)
            items.push(new ContextMenuItemBuilder()
                .text('新增block')
                .type('text')
                .click(this._addBlock)
                .build())
        }
        else
            return
        this._contextmenuSvc.openPanel(items, e)
    }

    private _init() {
        this.add(this._canvas.startCellMng.startCell$().subscribe(e => {
            if (e === undefined || e.from !== 'contextmenu')
                return
            // tslint:disable-next-line: no-type-assertion
            this._contextmenu(e.event as MouseEvent)
        }))
    }

    private _addCol = () => {
        const sheet = this._canvas.dataSvc.sheetSvc.getActiveSheet()
        const {coodinate: {startCol: start}} = this._canvas.startCellMng.startCell
        const blocks = this._checkBlock()
        if (blocks.length !== 0) {
            this._blockProcess(blocks).subscribe(bls => {
                const payloads = bls.map(block => {
                    const shift = new LineShiftInBlockBuilder()
                        .cnt(1)
                        .horizontal(false)
                        .id(block.blockId)
                        .idx(start - block.colStart)
                        .insert(true)
                        .sheetIdx(sheet)
                        .build()
                    return new PayloadBuilder()
                        .payloadOneof(
                            shift,
                            _Payload_Payload_oneof.LINE_SHIFT_IN_BLOCK
                        )
                        .build()
                })
                this._send(...payloads)
            })
            return
        }
        const colShift = new ColumnShiftBuilder()
            .sheetIdx(sheet)
            .count(1)
            .start(start)
            .type(ShiftTypeEnum.INSERT)
            .build()
        const payload = new PayloadBuilder()
            .payloadOneof(colShift, _Payload_Payload_oneof.COLUMN_SHIFT)
            .build()
        this._send(payload)
    }

    private _removeCol = () => {
        const {coodinate: {startCol: start}} = this._canvas.startCellMng.startCell
        const sheet = this._canvas.dataSvc.sheetSvc.getActiveSheet()
        const blocks = this._checkBlock()
        if (blocks.length !== 0) {
            this._blockProcess(blocks).subscribe(bls => {
                const payloads = bls.map(block => {
                    const shift = new LineShiftInBlockBuilder()
                        .cnt(1)
                        .horizontal(false)
                        .id(block.blockId)
                        .idx(start - block.colStart)
                        .insert(false)
                        .sheetIdx(sheet)
                        .build()
                    return new PayloadBuilder()
                        .payloadOneof(
                            shift,
                            _Payload_Payload_oneof.LINE_SHIFT_IN_BLOCK
                        )
                        .build()
                })
                this._send(...payloads)
            })
            return
        }
        const rowShift = new ColumnShiftBuilder()
            .sheetIdx(sheet)
            .count(1)
            .start(start)
            .type(ShiftTypeEnum.DELETE)
            .build()
        const payload = new PayloadBuilder()
            .payloadOneof(rowShift, _Payload_Payload_oneof.COLUMN_SHIFT)
            .build()
        this._send(payload)
    }

    private _addRow = () => {
        const {coodinate: {startRow: start}} = this._canvas.startCellMng.startCell
        const sheet = this._canvas.dataSvc.sheetSvc.getActiveSheet()
        const blocks = this._checkBlock()
        if (blocks.length !== 0) {
            this._blockProcess(blocks).subscribe(bls => {
                const payloads = bls.map(block => {
                    const shift = new LineShiftInBlockBuilder()
                        .cnt(1)
                        .horizontal(true)
                        .id(block.blockId)
                        .idx(start - block.rowStart)
                        .insert(true)
                        .sheetIdx(sheet)
                        .build()
                    return new PayloadBuilder()
                        .payloadOneof(
                            shift,
                            _Payload_Payload_oneof.LINE_SHIFT_IN_BLOCK
                        )
                        .build()
                })
                this._send(...payloads)
            })
            return
        }
        const rowShift = new RowShiftBuilder()
            .sheetIdx(sheet)
            .count(1)
            .start(start)
            .type(ShiftTypeEnum.INSERT)
            .build()
        const payload = new PayloadBuilder()
            .payloadOneof(rowShift, _Payload_Payload_oneof.ROW_SHIFT)
            .build()
        this._send(payload)
    }

    private _removeRow = () => {
        const {coodinate: {startRow: start}} = this._canvas.startCellMng.startCell
        const sheet = this._canvas.dataSvc.sheetSvc.getActiveSheet()
        const blocks = this._checkBlock()
        if (blocks.length !== 0) {
            this._blockProcess(blocks).subscribe(bls => {
                const payloads = bls.map(block => {
                    const shift = new LineShiftInBlockBuilder()
                        .cnt(1)
                        .horizontal(true)
                        .id(block.blockId)
                        .idx(start - block.rowStart)
                        .insert(false)
                        .sheetIdx(sheet)
                        .build()
                    return new PayloadBuilder()
                        .payloadOneof(
                            shift,
                            _Payload_Payload_oneof.LINE_SHIFT_IN_BLOCK
                        )
                        .build()
                })
                this._send(...payloads)
            })
            return
        }
        const rowShift = new RowShiftBuilder()
            .sheetIdx(sheet)
            .count(1)
            .start(start)
            .type(ShiftTypeEnum.DELETE)
            .build()
        const payload = new PayloadBuilder()
            .payloadOneof(rowShift, _Payload_Payload_oneof.ROW_SHIFT)
            .build()
        this._send(payload)
    }

    private _addBlock = () => {
        const startCell = this._canvas.selectorMng.startCell
        const endCell = this._canvas.selectorMng.endCell ?? startCell
        const start = startCell.coodinate
        const end = endCell.coodinate
        const addBlock = new CreateBlockBuilder()
            .sheetIdx(this._canvas.dataSvc.sheetSvc.getActiveSheet())
            .colCnt(Math.abs(end.endCol - start.startCol) + 1)
            .rowCnt(Math.abs(end.endRow - start.startRow) + 1)
            .masterCol(start.startCol < end.startCol ? start.startCol : end.startCol)
            .masterRow(
                start.startRow < end.startRow ? start.startRow : end.startRow
            )
            .build()
        this._send(new PayloadBuilder()
            .payloadOneof(addBlock, _Payload_Payload_oneof.CREATE_BLOCK)
            .build())
    }
    private _checkBlock() {
        const startCell = this._canvas.selectorMng.startCell
        const {coodinate: start} = startCell
        const {coodinate: end} = this._canvas.selectorMng.endCell ?? startCell
        const curr = new RangeBuilder()
            .startRow(start.startRow)
            .endRow(end.endRow)
            .startCol(start.startCol)
            .endCol(end.endCol)
            .build()
        const blocks = this._canvas.dataSvc.sheetSvc.getBlocks()
        return blocks.filter(b => b.coordinate.cover(curr))
    }

    private _blockProcess(blocks: readonly StandardBlock[]) {
        const data: Data = {
            message: blocks.length === 1 ? '当前选择范围属于一个block，是否继续？' : '选择一个block',
            blocks,
        }
        return this._dialog
            .open(SelectBlockComponent, {data})
            .afterClosed()
            .pipe(map((bls?: readonly StandardBlock[]) => bls ?? []))
    }

    private _send(...payloads: readonly Payload[]) {
        if (payloads.length === 0)
            return
        const transaction = new TransactionBuilder().payloads(payloads).build()
        this._canvas.dataSvc.backend.send(transaction)
    }
}
