import {injectable} from 'inversify'
import {
    ActionEffect,
    CustomFunc,
    DisplayWindowWithStartPoint,
    Transaction,
    Workbook,
    Worksheet,
    SheetInfo,
    initWasm,
} from 'logisheets-web'

@injectable()
export class WorkbookService {
    public static async create(): Promise<WorkbookService> {
        const instance = new WorkbookService()
        await instance._init()
        return instance
    }

    public registryCustomFunc(f: CustomFunc) {
        this.workbook.registryCustomFunc(f)
    }

    public registryCellUpdatedCallback(f: () => void) {
        this.workbook.registerCellUpdatedCallback(f)
    }

    public registrySheetUpdatedCallback(f: () => void) {
        this.workbook.registerSheetInfoUpdateCallback(f)
    }

    public handleTransaction(transaction: Transaction): ActionEffect {
        return this.workbook.execTransaction(transaction)
    }

    public getAllSheetInfo(): readonly SheetInfo[] {
        return this.workbook.getAllSheetInfo()
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

    private async _init() {
        await initWasm()
        this._workbookImpl = new Workbook()
    }

    public get workbook(): Workbook {
        if (!this._workbookImpl) throw Error("haven't been initialized")
        return this._workbookImpl
    }

    private _workbookImpl: Workbook | undefined
}
