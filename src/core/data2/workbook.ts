import {injectable} from 'inversify'
import {
    ActionEffect,
    CustomFunc,
    Transaction,
    Workbook,
    initWasm,
    DisplayWindowWithStartPoint,
} from '@logisheets_bg'

@injectable()
export class WorkbookService {
    public constructor(funcs: readonly CustomFunc[]) {
        this._init(funcs)
    }

    public registryCustomFunc(f: CustomFunc) {
        this._workbook.registryCustomFunc(f)
    }

    public registryCellUpdatedCallback(f: () => void) {
        this._workbook.registerCellUpdatedCallback(f)
    }

    public handleTransaction(
        transaction: Transaction,
        undoable: boolean
    ): ActionEffect {
        return this._workbook.execTransaction(transaction, undoable)
    }

    public getDisplayWindow(
        sheetIdx: number,
        startX: number,
        startY: number,
        height: number,
        width: number
    ): DisplayWindowWithStartPoint {
        const ws = this._workbook.getWorksheet(sheetIdx)
        return ws.getDisplayWindowWithStartPoint(startX, startY, height, width)
    }

    public getDisplayWindowWithCellPosition(
        sheetIdx: number,
        row: number,
        col: number,
        height: number,
        width: number
    ): DisplayWindowWithStartPoint {
        const ws = this._workbook.getWorksheet(sheetIdx)
        return ws.getDisplayWindowWithCellPosition(row, col, height, width)
    }

    public undo() {
        this._workbook.undo()
        return
    }

    public redo() {
        this._workbook.redo()
    }

    public loadWorkbook(content: Uint8Array, name: string) {
        this._workbook.load(content, name)
    }

    private async _init(funcs: readonly CustomFunc[]) {
        await initWasm()
        this._workbookImpl = new Workbook()
        funcs.forEach((f) => {
            this._workbook.registryCustomFunc(f)
        })
    }

    private get _workbook(): Workbook {
        if (!this._workbookImpl) throw Error('')
        return this._workbookImpl
    }

    private _workbookImpl: Workbook | undefined
}
