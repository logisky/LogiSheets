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
    GetCraftStateMethodName,
    BlockId,
    MethodName,
} from 'logisheets-craft-forge'

export class CraftHandler implements CraftHandlerInterface {
    public constructor(
        private readonly _workbookClient: WorkbookClient,
        private readonly _getFrameByBlockId: (
            blockId: BlockId
        ) => Promise<HTMLIFrameElement>,
        private readonly _stateUpdatedCallback: (blockId: BlockId) => void
    ) {
        window.addEventListener('message', (e) => {
            const {m, id, args} = e.data
            if (m === MethodName.GetSheetDimension) {
                this.getSheetDimension(args).then((result) => {
                    e.source?.postMessage({
                        m: MethodName.GetSheetDimension,
                        id,
                        result,
                    })
                })
            } else if (m === MethodName.GetAllSheetInfo) {
                this.getAllSheetInfo(args).then((result) => {
                    e.source?.postMessage({
                        m: MethodName.GetAllSheetInfo,
                        id,
                        result,
                    })
                })
            } else if (m === MethodName.GetDisplayWindow) {
                this.getDisplayWindow(args).then((result) => {
                    e.source?.postMessage({
                        m: MethodName.GetDisplayWindow,
                        id,
                        result,
                    })
                })
            } else if (m === MethodName.GetCell) {
                this.getCell(args).then((result) => {
                    e.source?.postMessage({
                        m: MethodName.GetCell,
                        id,
                        result,
                    })
                })
            } else if (m === MethodName.GetCellPosition) {
                this.getCellPosition(args).then((result) => {
                    e.source?.postMessage({
                        m: MethodName.GetCellPosition,
                        id,
                        result,
                    })
                })
            } else if (m === MethodName.GetFullyCoveredBlocks) {
                this.getFullyCoveredBlocks(args).then((result) => {
                    e.source?.postMessage({
                        m: MethodName.GetFullyCoveredBlocks,
                        id,
                        result,
                    })
                })
            } else if (m === MethodName.GetMergedCells) {
                this.getMergedCells(args).then((result) => {
                    e.source?.postMessage({
                        m: MethodName.GetMergedCells,
                        id,
                        result,
                    })
                })
            } else if (m === MethodName.CalcCondition) {
                this.calcCondition(args).then((result) => {
                    e.source?.postMessage({
                        m: MethodName.CalcCondition,
                        id,
                        result,
                    })
                })
            } else if (m === MethodName.GetBlockRowId) {
                this.getBlockRowId(args).then((result) => {
                    e.source?.postMessage({
                        m: MethodName.GetBlockRowId,
                        id,
                        result,
                    })
                })
            } else if (m === MethodName.GetBlockColId) {
                this.getBlockColId(args).then((result) => {
                    e.source?.postMessage({
                        m: MethodName.GetBlockColId,
                        id,
                        result,
                    })
                })
            } else if (m === MethodName.StateUpdated) {
                this._stateUpdatedCallback(args.blockId)
            } else {
                throw new Error('Unknown method: ' + m)
            }
        })
    }

    async getCraftState(blockId: BlockId): Promise<CraftState> {
        const message = {
            m: GetCraftStateMethodName,
            toBlock: blockId,
        }
        const iframe = await this._getFrameByBlockId(blockId)
        return new Promise((resolve) => {
            const callback = (e: MessageEvent) => {
                if (e.data.m === GetCraftStateMethodName) {
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
