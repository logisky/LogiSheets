import {
    BlockInfo,
    CalcConditionParams,
    Cell,
    CellPosition,
    ColId,
    CustomFunc,
    DisplayWindowWithStartPoint,
    GetAllSheetInfoParams,
    GetBlockColIdParams,
    GetBlockRowIdParams,
    GetCellParams,
    GetDisplayWindowParams,
    GetFullyCoveredBlocksParams,
    GetMergedCellsParams,
    HandleTransactionParams,
    LoadWorkbookParams,
    MergeCell,
    Resp,
    RowId,
    SheetDimension,
    SheetInfo,
    Client as WorkbookClient,
} from 'logisheets-web'
import {
    CraftState,
    CraftHandler as CraftHandlerInterface,
    CraftId,
} from 'logisheets-craft'

export interface CraftIframeManager {
    getIframe(craftId: CraftId): HTMLIFrameElement
}

export class CraftHandler implements CraftHandlerInterface {
    public constructor(
        private readonly _workbookClient: WorkbookClient,
        private readonly _craftIframeManager: CraftIframeManager
    ) {}

    getCraftState(craftId: CraftId): Promise<CraftState> {
        const message = {
            m: 'getCraftState',
            toCraft: craftId,
        }
        const iframe = this._craftIframeManager.getIframe(craftId)
        return new Promise((resolve) => {
            const callback = (e: MessageEvent) => {
                if (e.data.m === 'getCraftState') {
                    resolve(e.data.state)
                    window.removeEventListener('message', callback)
                }
            }
            window.addEventListener('message', callback)
            iframe.contentWindow?.postMessage(message, '*')
        })
    }

    isReady(): Promise<void> {
        return this._workbookClient.isReady()
    }

    getSheetDimension(sheetIdx: number): Resp<SheetDimension> {
        return this._workbookClient.getSheetDimension(sheetIdx)
    }

    getAllSheetInfo(params: GetAllSheetInfoParams): Resp<readonly SheetInfo[]> {
        return this._workbookClient.getAllSheetInfo(params)
    }

    getDisplayWindow(
        params: GetDisplayWindowParams
    ): Resp<DisplayWindowWithStartPoint> {
        return this._workbookClient.getDisplayWindow(params)
    }

    getCell(params: GetCellParams): Resp<Cell> {
        return this._workbookClient.getCell(params)
    }

    getCellPosition(params: GetCellParams): Resp<CellPosition> {
        return this._workbookClient.getCellPosition(params)
    }

    getFullyCoveredBlocks(
        params: GetFullyCoveredBlocksParams
    ): Resp<readonly BlockInfo[]> {
        return this._workbookClient.getFullyCoveredBlocks(params)
    }

    undo(): Resp<void> {
        return this._workbookClient.undo()
    }

    redo(): Resp<void> {
        return this._workbookClient.redo()
    }

    handleTransaction(params: HandleTransactionParams): Resp<void> {
        return this._workbookClient.handleTransaction(params)
    }

    loadWorkbook(params: LoadWorkbookParams): Resp<void> {
        return this._workbookClient.loadWorkbook(params)
    }

    registryCustomFunc(f: CustomFunc): void {
        this._workbookClient.registryCustomFunc(f)
    }

    registryCellUpdatedCallback(f: () => void): void {
        this._workbookClient.registryCellUpdatedCallback(f)
    }

    registrySheetUpdatedCallback(f: () => void): void {
        this._workbookClient.registrySheetUpdatedCallback(f)
    }

    getMergedCells(params: GetMergedCellsParams): Resp<readonly MergeCell[]> {
        return this._workbookClient.getMergedCells(params)
    }

    calcCondition(params: CalcConditionParams): Resp<boolean> {
        return this._workbookClient.calcCondition(params)
    }

    getBlockRowId(params: GetBlockRowIdParams): Resp<RowId> {
        return this._workbookClient.getBlockRowId(params)
    }

    getBlockColId(params: GetBlockColIdParams): Resp<ColId> {
        return this._workbookClient.getBlockColId(params)
    }
}
