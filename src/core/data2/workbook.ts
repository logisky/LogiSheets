import {getID} from '@/core/ioc/id'
import {injectable} from 'inversify'
import {
    ActionEffect,
    CustomFunc,
    DisplayWindowWithStartPoint,
    RowInfo,
    Transaction,
    Workbook,
    initWasm,
    isErrorMessage,
} from '@logisheets_bg'
import {ColInfo} from '@logisheets_bg'

@injectable()
export class WorkbookService {
    readonly id = getID()

    public constructor(funcs: readonly CustomFunc[]) {
        this._init(funcs)
    }

    public registryCustomFunc(f: CustomFunc) {
        this._workbook.registryCustomFunc(f)
    }

    public registryRender(render: () => void) {
        this._workbook.registerUpdateCallback(render)
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
        endX: number,
        endY: number
    ): DisplayWindowWithStartPoint {
        const ws = this._workbook.getWorksheet(sheetIdx)
        return ws.getDisplayWindowWithStartPoint(startX, startY, endX, endY)
    }

    public getRowInfo(sheetIdx: number, row: number): RowInfo {
        const rowInfo = this._workbook.getWorksheet(sheetIdx).getRowInfo(row)
        if (isErrorMessage(rowInfo)) {
            throw Error(rowInfo.msg)
        }
        return rowInfo
    }

    public getColInfo(sheetIdx: number, col: number): ColInfo {
        const colInfo = this._workbook.getWorksheet(sheetIdx).getColInfo(col)
        if (isErrorMessage(colInfo)) {
            throw Error(colInfo.msg)
        }
        return colInfo
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
