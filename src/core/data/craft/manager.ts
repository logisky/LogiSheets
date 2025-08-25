import {injectable} from 'inversify'
import {
    BlockId,
    CraftData,
    CraftDescriptor,
    CraftId,
    CraftState,
    CraftValue,
    DataArea,
    DiyButtonConfig,
    DiyCellButtonType,
    MethodName,
    generatePayloads,
} from 'logisheets-craft-forge'
import {
    blockInfoNotFound,
    descriptorNotFound,
    err,
    ok,
    ResultAsync,
    workbookError,
    Result,
} from '../../error'
import {WorkbookClient} from '../workbook'
import {CraftHandler} from './handler'
import {DiyButtonManager} from './diy_btn_manager'
import {
    CellClearBuilder,
    CellInputBuilder,
    CellValue,
    CreateAppendixBuilder,
    isErrorMessage,
    Payload,
    ResizeBlockBuilder,
    Value,
} from 'logisheets-web'
import {ClientImpl} from './client'

export const LOGISHEETS_BUILTIN_CRAFT_ID = 'logisheets'
export const FIELD_AND_VALIDATION_TAG = 80

const DEFAULT_BASE_URL = 'http://localhost:3000'

export interface CraftManifest {
    /**
     * The craft's unique identifier.
     */
    id: CraftId
    /**
     * The craft's icon url.
     */
    icon: string
    /**
     * The URL to the craft's HTML file.
     */
    html: string
}

/**
 * Craft manager is used to load and manage the crafts, provide the iframes and bind the blocks with the crafts.
 *
 * Block IDs, block ranges and craft URLs are supposed to be stored in the workbook file.
 * And when the application starts, it will fetch the craft manifest from the URL, register it and bind the blocks.
 */
@injectable()
export class CraftManager {
    public constructor(private readonly _workbookClient: WorkbookClient) {
        this._iframe = document.createElement('iframe')
        const handler = new CraftHandler(
            this._workbookClient,
            async (blockId: BlockId) => {
                await this.openIframeForBlock(blockId)
                return this._iframe
            },
            (blockId: BlockId) => {
                if (this._currentBlockId !== blockId) {
                    throw new Error('unmatched block id')
                }
                this._dirty = true
            }
        )
        this._handler = handler
    }

    public async registerCraftFromUrl(url: string) {
        const manifest = await fetch(url).then((res) => res.json())
        return this.registerCraftFromManifest(manifest)
    }

    public registerCraftFromManifest(craft: CraftManifest) {
        for (const each of this._crafts) {
            if (each.id === craft.id) {
                // Has been registered before
                return
            }
        }
        this._crafts.push(craft)
    }

    public registerDiyButton(diyId: number, config: DiyButtonConfig) {
        this._diyBtnManager.registerDiyButton(diyId, config)
    }

    public getCraftIcons(): readonly HTMLImageElement[] {
        return this._crafts.map((each) => {
            const img = document.createElement('img')
            img.src = each.icon
            return img
        })
    }

    /**
     * Bind a block to a craft.`
     */
    public bindBlock(blockId: BlockId, craftId: CraftId) {
        const key = blockIdToString(blockId)
        if (this._blockToCraft.has(key)) {
            throw new Error(
                `Block with id ${key} already bound to craft ${this._blockToCraft.get(
                    key
                )}`
            )
        }
        this._blockToCraft.set(key, craftId)
    }

    public async openIframeForBlock(blockId: BlockId): Promise<void> {
        if (this._currentBlockId && this._dirty) {
            const currentKey = blockIdToString(this._currentBlockId)
            // The current block id state is dirty. We should update it first.
            const state = await this._handler.getCraftState(
                this._currentBlockId
            )
            this._craftStates.set(currentKey, state)
        }

        const key = blockIdToString(blockId)
        if (!this._blockToCraft.has(key))
            throw Error('block id has not been binded')
        const craftId = this._blockToCraft.get(key)

        const state = this._craftStates.get(key)
        const manifest = this._crafts.find((v) => v.id === craftId)
        if (!manifest) throw Error('craft has not been registered')
        this._iframe.src = manifest?.html
        const message = {
            m: MethodName.LoadCraftStateMethodName,
            toBlock: blockId,
            state,
        }
        return new Promise((resolve) => {
            const callback = (e: MessageEvent) => {
                if (e.data.m === MethodName.LoadCraftStateMethodName) {
                    resolve()
                    window.removeEventListener('message', callback)
                }
            }
            window.addEventListener('message', callback)
            this._iframe.contentWindow?.postMessage(message, '*')
        })
    }

    // Extract values from the workbook.

    async onDiyCellClick(id: number): Promise<void> {
        const type = this._diyBtnManager.getDiyButtonType(id)
        if (type === undefined) return
        switch (type) {
            case DiyCellButtonType.Upload: {
                const config = this._diyBtnManager.getUploadButtonConfig(id)
                if (!config) return
                // const values = await this.extractBlockValues(config.blockId)
                // const url = config.url
                // if (!url) return
                // await fetch(url, {
                //     method: 'POST',
                //     body: JSON.stringify(values),
                //     headers: {
                //         'Content-Type': 'application/json',
                //     },
                // })
                break
            }
            case DiyCellButtonType.Download:
            case DiyCellButtonType.Image:
            default:
                // Not implemented or no action needed
                break
        }
    }

    addCraftDescriptor(blockId: BlockId, descriptor: CraftDescriptor) {
        descriptor.workbookPart = undefined
        const key = blockIdToString(blockId)
        this._craftDescriptors.set(key, descriptor)
    }

    getCraftDescriptor(blockId: BlockId): Result<CraftDescriptor> {
        const key = blockIdToString(blockId)
        const descriptor = this._craftDescriptors.get(key)
        if (descriptor === undefined)
            return err(descriptorNotFound(blockId[0], blockId[1]))
        return ok(descriptor)
    }

    /**
     * Unlike `getCraftDescriptor`, this function will get workbook part
     */
    async exportCraftDescriptor(
        blockId: BlockId
    ): ResultAsync<CraftDescriptor> {
        const descriptorResult = this.getCraftDescriptor(blockId)
        if (!descriptorResult)
            return err(descriptorNotFound(blockId[0], blockId[1]))

        const descriptor = descriptorResult._unsafeUnwrap()

        const sheetIdx = await this._workbookClient.getSheetIdx({
            sheetId: blockId[0],
        })
        if (isErrorMessage(sheetIdx)) return err(workbookError(sheetIdx.msg))
        const blockInfo = await this._workbookClient.getBlockInfo({
            sheetId: blockId[0],
            blockId: blockId[1],
        })
        if (isErrorMessage(blockInfo)) return err(workbookError(blockInfo.msg))

        const coordinates = []
        const endRow = descriptor.dataArea.endRow ?? blockInfo.rowCnt
        const endCol = descriptor.dataArea.endCol ?? blockInfo.colCnt
        for (let i = 0; i < blockInfo.rowCnt; i++) {
            for (let j = 0; j < blockInfo.colCnt; j++) {
                if (
                    i >= descriptor.dataArea.startRow ||
                    i <= endRow ||
                    j >= descriptor.dataArea.startCol ||
                    j <= endCol
                )
                    continue
                coordinates.push({row: i, col: j})
            }
        }

        const cells = await this._workbookClient.getReproducibleCells({
            sheetIdx: sheetIdx,
            coordinates: coordinates,
        })
        if (isErrorMessage(cells)) return err(workbookError(cells.msg))
        const workbookPart = {
            cells: cells,
            rowCount: blockInfo.rowCnt,
            colCount: blockInfo.colCnt,
        }
        return ok({
            ...descriptor,
            workbookPart: workbookPart,
        })
    }

    async uploadCraftDescriptor(blockId: BlockId): ResultAsync<string> {
        const descriptorResult = await this.exportCraftDescriptor(blockId)
        if (descriptorResult.isErr())
            return err(descriptorResult._unsafeUnwrapErr())

        const descriptor = descriptorResult._unsafeUnwrap()
        const baseUrl = descriptor.dataPort?.baseUrl ?? DEFAULT_BASE_URL
        let id = descriptor.dataPort?.identifier
        if (id === undefined) {
            const idResult = await this._client.getId(baseUrl)
            if (idResult.isErr()) return err(idResult._unsafeUnwrapErr())
            id = idResult._unsafeUnwrap()
        }
        const result = await this._client.uploadDescriptor(
            baseUrl,
            id,
            descriptor
        )
        if (result.isErr()) return err(result._unsafeUnwrapErr())
        return ok(result._unsafeUnwrap())
    }

    async uploadCraftData(blockId: BlockId): ResultAsync<void> {
        const data = await this.exportDataArea(blockId)
        if (data.isErr()) return err(data._unsafeUnwrapErr())
        const descriptorResult = this.getCraftDescriptor(blockId)
        if (descriptorResult.isErr())
            return err(descriptorResult._unsafeUnwrapErr())
        const descriptor = descriptorResult._unsafeUnwrap()
        const baseUrl = descriptor.dataPort?.baseUrl ?? DEFAULT_BASE_URL
        let id = descriptor.dataPort?.identifier
        if (id === undefined) {
            const idResult = await this._client.getId(baseUrl)
            if (idResult.isErr()) return err(idResult._unsafeUnwrapErr())
            id = idResult._unsafeUnwrap()
        }
        const result = await this._client.uploadCraftData(
            baseUrl,
            id,
            data._unsafeUnwrap()
        )
        if (result.isErr()) return err(result._unsafeUnwrapErr())
        return ok(undefined)
    }

    async downloadDescriptor(
        sheetIdx: number,
        masterRow: number,
        masterCol: number,
        identifier: string
    ): ResultAsync<readonly Payload[]> {
        const baseUrl = DEFAULT_BASE_URL
        const descriptorResult = await this._client.downloadDescriptor(
            baseUrl,
            identifier
        )
        if (descriptorResult.isErr())
            return err(descriptorResult._unsafeUnwrapErr())

        const descriptor = descriptorResult._unsafeUnwrap()
        const idResult = await this._workbookClient.getAvailableBlockId({
            sheetIdx: sheetIdx,
        })
        if (isErrorMessage(idResult)) return err(workbookError(idResult.msg))
        const id = idResult
        this._craftDescriptors.set(identifier, descriptor)
        return ok(
            generatePayloads(sheetIdx, id, masterRow, masterCol, descriptor)
        )
    }

    async downloadCraftData(blockId: BlockId): ResultAsync<readonly Payload[]> {
        const descriptorResult = this.getCraftDescriptor(blockId)
        if (descriptorResult.isErr())
            return err(descriptorResult._unsafeUnwrapErr())
        const descriptor = descriptorResult._unsafeUnwrap()
        const baseUrl = descriptor?.dataPort?.baseUrl ?? DEFAULT_BASE_URL
        let id = descriptor?.dataPort?.identifier
        if (id === undefined) {
            const idResult = await this._client.getId(baseUrl)
            if (idResult.isErr()) return err(idResult._unsafeUnwrapErr())
            id = idResult._unsafeUnwrap()
        }
        const dataArea = descriptor.dataArea
        const infoResult = await this._workbookClient.getBlockInfo({
            sheetId: blockId[0],
            blockId: blockId[1],
        })
        if (isErrorMessage(infoResult))
            return err(workbookError(infoResult.msg))
        const info = infoResult
        const masterRow = info.rowStart
        const masterCol = info.colStart
        const descriptorRowSize = dataArea.startRow
        const dataResult = await this._client.downloadCraftData(baseUrl, id)
        if (dataResult.isErr()) return err(dataResult._unsafeUnwrapErr())
        const data = dataResult._unsafeUnwrap()

        const sheetIdx = await this._workbookClient.getSheetIdx({
            sheetId: blockId[0],
        })
        if (isErrorMessage(sheetIdx)) return err(workbookError(sheetIdx.msg))
        const newRowCnt = data.values.length + descriptorRowSize
        const payloads: Payload[] = [
            {
                type: 'resizeBlock',
                value: new ResizeBlockBuilder()
                    .sheetIdx(sheetIdx)
                    .id(blockId[1])
                    .newRowCnt(newRowCnt)
                    .build(),
            },
        ]

        const fieldMap = await this.getFieldMap(blockId, dataArea)
        const keyArray: string[] = []
        const fieldKeyValue = new Map<[string, string], Value>()
        data.values.forEach((v) => {
            const key = v.key
            const field = v.field
            const value = v.value
            fieldKeyValue.set([key, field], value)
            if (keyArray.includes(key)) return
            keyArray.push(key)
        })

        for (
            let r = dataArea.startRow;
            r < (dataArea.endRow ?? newRowCnt - 1);
            r++
        ) {
            const idx = r - dataArea.startRow
            if (idx >= keyArray.length) break
            const key = keyArray[idx]
            const row = masterRow + r
            for (
                let c = dataArea.startCol;
                c < (dataArea.endCol ?? info.colCnt - 1);
                c++
            ) {
                const col = masterCol + c
                const f = fieldMap.get(c)
                if (f === undefined) continue
                const v = fieldKeyValue.get([key, f])
                if (v === undefined) continue
                const clearPayload: Payload = {
                    type: 'cellClear',
                    value: new CellClearBuilder()
                        .sheetIdx(sheetIdx)
                        .row(row)
                        .col(col)
                        .build(),
                }
                const payload: Payload = {
                    type: 'cellInput',
                    value: new CellInputBuilder()
                        .sheetIdx(sheetIdx)
                        .row(row)
                        .col(col)
                        .content(v.toString())
                        .build(),
                }
                payloads.push(clearPayload, payload)
            }
        }

        if (dataArea.startCol > 0) {
            const col = masterCol + dataArea.startCol - 1
            keyArray.forEach((key, idx) => {
                const row = masterRow + dataArea.startRow + idx
                const clearPayload: Payload = {
                    type: 'cellClear',
                    value: new CellClearBuilder()
                        .sheetIdx(sheetIdx)
                        .row(row)
                        .col(col)
                        .build(),
                }
                const payload: Payload = {
                    type: 'cellInput',
                    value: new CellInputBuilder()
                        .sheetIdx(sheetIdx)
                        .row(row)
                        .col(col)
                        .content(key)
                        .build(),
                }
                payloads.push(clearPayload, payload)
            })
        }

        return ok(payloads)
    }

    async getFieldMap(
        blockId: BlockId,
        dataArea: DataArea
    ): Promise<Map<number, string>> {
        const descriptor = this.getCraftDescriptor(blockId)
        if (!descriptor) throw Error('')
        const blockInfo = await this._workbookClient.getBlockInfo({
            sheetId: blockId[0],
            blockId: blockId[1],
        })
        if (isErrorMessage(blockInfo)) throw Error('')
        const masterRow = blockInfo.rowStart
        const masterCol = blockInfo.colStart
        const endCol = dataArea.endCol ?? blockInfo.colCnt - 1
        const fieldMAp = new Map<number, string>()
        for (let i = dataArea.startCol; i <= endCol; i++) {
            const appendix = await this._workbookClient.lookupAppendixUpward({
                sheetId: blockId[0],
                blockId: blockId[1],
                row: i,
                col: dataArea.startCol,
                craftId: LOGISHEETS_BUILTIN_CRAFT_ID,
                tag: FIELD_AND_VALIDATION_TAG,
            })
            if (isErrorMessage(appendix)) continue
            const r = masterRow + appendix.rowIdx
            const c = masterCol + appendix.colIdx
            const v = await this._workbookClient.getValue({
                sheetId: blockId[0],
                row: r,
                col: c,
            })
            if (isErrorMessage(v)) continue
            const vStr = CellValue.from(v).valueStr
            fieldMAp.set(appendix.colIdx, vStr)
        }
        return fieldMAp
    }

    async exportDataArea(blockId: BlockId): ResultAsync<CraftData> {
        const descriptorResult = this.getCraftDescriptor(blockId)
        if (descriptorResult.isErr())
            return err(descriptorResult._unsafeUnwrapErr())
        const descriptor = descriptorResult._unsafeUnwrap()
        const blockInfo = await this._workbookClient.getBlockInfo({
            sheetId: blockId[0],
            blockId: blockId[1],
        })
        if (isErrorMessage(blockInfo))
            return err(blockInfoNotFound(blockId[0], blockId[1]))

        const masterRow = blockInfo.rowStart
        const masterCol = blockInfo.colStart
        const dataArea = descriptor.dataArea
        const endCol = dataArea.endCol ?? blockInfo.colCnt - 1

        const fieldMap = await this.getFieldMap(blockId, dataArea)

        const keyMap = new Map()
        const endRow = dataArea.endRow ?? blockInfo.rowCnt - 1
        for (let j = dataArea.startRow; j <= endRow; j++) {
            let key = ''
            if (dataArea.startCol === 0) {
                keyMap.set(j, key)
                continue
            }

            const v = await this._workbookClient.getValue({
                sheetId: blockId[0],
                row: j + masterRow,
                col: dataArea.startCol - 1 + masterCol,
            })
            if (isErrorMessage(v)) {
                keyMap.set(j, key)
                continue
            }
            const vStr = CellValue.from(v).valueStr
            key = vStr
            keyMap.set(j, key)
        }
        const sr = masterRow + dataArea.startRow
        const sc = masterCol + dataArea.startCol
        const er = masterRow + endRow
        const ec = masterCol + endCol
        const cells = await this._workbookClient.getCells({
            sheetIdx: blockInfo.sheetIdx,
            startRow: sr,
            startCol: sc,
            endRow: er,
            endCol: ec,
        })
        if (isErrorMessage(cells)) return err(workbookError(cells.msg))
        const rowCount = er - sr + 1
        const colCount = ec - sc + 1
        const result: CraftValue[] = []
        for (let r = 0; r < rowCount; r++) {
            for (let c = 0; c < colCount; c++) {
                const i = c + r * rowCount
                const cell = cells[i]
                const field = fieldMap.get(c + masterCol)
                if (field === undefined) continue
                let key = keyMap.get(r + masterRow)
                if (key === undefined) {
                    key = ''
                }
                const v: CraftValue = {
                    key,
                    field,
                    value: cell.toCellInfo().value,
                }
                result.push(v)
            }
        }
        return ok({values: result})
    }

    private _crafts: CraftManifest[] = []
    private _blockToCraft: Map<string, CraftId> = new Map()
    private _craftStates: Map<string, CraftState> = new Map()
    private _craftDescriptors: Map<string, CraftDescriptor> = new Map()
    private _iframe!: HTMLIFrameElement
    private _handler: CraftHandler

    private _diyBtnManager: DiyButtonManager = new DiyButtonManager()

    private _currentBlockId: BlockId | undefined
    private _dirty = false
    private _client = new ClientImpl()
}

function blockIdToString(blockId: BlockId) {
    return `${blockId[0]}-${blockId[1]}`
}
