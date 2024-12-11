import {injectable} from 'inversify'
import {
    ActionEffect,
    CustomFunc,
    Transaction,
    Workbook,
    initWasm,
    DisplayWindowWithStartPoint,
} from '@logisheets_bg'
import {Worksheet} from '@logisheets_bg'

@injectable()
export class WorkbookService {
    public constructor(funcs: readonly CustomFunc[]) {
        this._init(funcs)
    }

    public registryCustomFunc(f: CustomFunc) {
        this.workbook.registryCustomFunc(f)
    }

    public registryCellUpdatedCallback(f: () => void) {
        this.workbook.registerCellUpdatedCallback(f)
    }

    public handleTransaction(transaction: Transaction): ActionEffect {
        return this.workbook.execTransaction(transaction)
    }

    public getDisplayWindow(
        sheetIdx: number,
        startX: number,
        startY: number,
        height: number,
        width: number
    ): DisplayWindowWithStartPoint {
        const ws = this.workbook.getWorksheet(sheetIdx)
        return ws.getDisplayWindowWithStartPoint(startX, startY, height, width)
    }

    public getDisplayWindowWithCellPosition(
        sheetIdx: number,
        row: number,
        col: number,
        height: number,
        width: number
    ): DisplayWindowWithStartPoint {
        const ws = this.workbook.getWorksheet(sheetIdx)
        return ws.getDisplayWindowWithCellPosition(row, col, height, width)
    }

    public getSheetByIdx(sheetIdx: number): Worksheet {
        return this.workbook.getWorksheet(sheetIdx)
    }

    public undo() {
        this.workbook.undo()
        return
    }

    public redo() {
        this.workbook.redo()
    }

    public loadWorkbook(content: Uint8Array, name: string) {
        const result = this.workbook.load(content, name)
        if (result != 0) {
            throw Error('error opening file')
        }
    }

    private async _init(funcs: readonly CustomFunc[]) {
        await initWasm()
        this._workbookImpl = new Workbook()
        funcs.forEach((f) => {
            this.workbook.registryCustomFunc(f)
        })
    }

    public get workbook(): Workbook {
        if (!this._workbookImpl) throw Error('')
        return this._workbookImpl
    }

    private _workbookImpl: Workbook | undefined
}
