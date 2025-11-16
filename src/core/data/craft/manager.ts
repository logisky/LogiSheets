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
import {WorkbookClient} from '../clients'
import {CraftHandler} from './handler'
import {DiyButtonManager} from './diy_btn_manager'
import {
    BlockField,
    CellClearBuilder,
    CellInputBuilder,
    CellValue,
    EphemeralCellInputBuilder,
    isErrorMessage,
    Payload,
    ResizeBlockBuilder,
    Value,
} from 'logisheets-web'
import {ClientImpl} from './client'
import {EnumSetManager} from './enum_set_manager'
import {FieldInfo, FieldManager} from './field_manager'

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

    public enumSetManager = new EnumSetManager()
    public fieldManager = new FieldManager()

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

    getUserId(): ResultAsync<string> {
        return this._client.getUserId()
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
        if (
            descriptor.dataPort?.identifier === undefined ||
            descriptor.dataPort?.identifier === ''
        ) {
            const idResult = await this._client.getId()
            if (idResult.isErr()) return err(idResult._unsafeUnwrapErr())
            descriptor.dataPort!.identifier = idResult._unsafeUnwrap()
        }

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

        const masterRow = blockInfo.rowStart
        const masterCol = blockInfo.colStart
        for (let i = 0; i < blockInfo.rowCnt; i++) {
            for (let j = 0; j < blockInfo.colCnt; j++) {
                // skip the data area
                if (
                    i >= descriptor.dataArea.startRow &&
                    i <= endRow &&
                    j >= descriptor.dataArea.startCol &&
                    j <= endCol
                )
                    continue
                coordinates.push({row: i + masterRow, col: j + masterCol})
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

    async setValidationRules(
        blockId: BlockId,
        valueChangedCallback: (shadowId: number) => void,
        cellRemovedCallback: (shadowId: number) => void
    ): ResultAsync<void> {
        const descriptorResult = this.getCraftDescriptor(blockId)
        if (descriptorResult.isErr())
            return err(descriptorResult._unsafeUnwrapErr())
        const descriptor = descriptorResult._unsafeUnwrap()
        const fieldMap = await this.getFieldMap(blockId, descriptor.dataArea)
        const blockInfo = await this._workbookClient.getBlockInfo({
            sheetId: blockId[0],
            blockId: blockId[1],
        })
        if (isErrorMessage(blockInfo)) return err(workbookError(blockInfo.msg))
        const dataEndCol = descriptor.dataArea.endCol ?? blockInfo.colCnt - 1
        const dataEndRow = descriptor.dataArea.endRow ?? blockInfo.rowCnt - 1
        const sheetIdx = blockInfo.sheetIdx
        const payloads: Payload[] = []

        for (let j = descriptor.dataArea.startCol; j <= dataEndCol; j++) {
            const field = fieldMap.get(j)
            if (field === undefined || field[1] === '') {
                continue
            }
            for (let i = descriptor.dataArea.startRow; i <= dataEndRow; i++) {
                const r = blockInfo.rowStart + i
                const c = blockInfo.colStart + j
                const shadowId =
                    await this._workbookClient.registerShadowCellValueChangedCallback(
                        sheetIdx,
                        r,
                        c,
                        (sheetCellId) => {
                            const cellId = sheetCellId.cellId
                            if (cellId.type === 'ephemeralCell') {
                                valueChangedCallback(cellId.value)
                            }
                        }
                    )
                if (isErrorMessage(shadowId))
                    return err(workbookError(shadowId.msg))
                this._workbookClient.registerCellRemovedCallback(
                    sheetIdx,
                    r,
                    c,
                    (sheetCellId) => {
                        const cellId = sheetCellId.cellId
                        if (cellId.type === 'ephemeralCell') {
                            cellRemovedCallback(cellId.value)
                        }
                    }
                )
                const payload = new EphemeralCellInputBuilder()
                    .content(`=${field[1]}`)
                    .sheetIdx(sheetIdx)
                    .id(shadowId)
                    .build()
                payloads.push({type: 'ephemeralCellInput', value: payload})
            }
        }

        if (payloads.length === 0) {
            return err(workbookError('No payload generated'))
        }

        const result = await this._workbookClient.handleTransaction({
            transaction: {
                payloads: payloads,
                undoable: false,
            },
        })

        if (isErrorMessage(result)) {
            return err(workbookError(result.msg))
        }

        return ok(undefined)
    }

    async uploadCraftDescriptor(blockId: BlockId): ResultAsync<string> {
        const descriptorResult = await this.exportCraftDescriptor(blockId)
        if (descriptorResult.isErr())
            return err(descriptorResult._unsafeUnwrapErr())

        const descriptor = descriptorResult._unsafeUnwrap()
        let id = descriptor.dataPort?.identifier
        if (id === undefined || id === '') {
            const idResult = await this._client.getId()
            if (idResult.isErr()) return err(idResult._unsafeUnwrapErr())
            id = idResult._unsafeUnwrap()
            descriptor.dataPort = {
                baseUrl: descriptor.dataPort?.baseUrl ?? '',
                identifier: id,
            }
            this.addCraftDescriptor(blockId, descriptor)
        }
        const result = await this._client.uploadDescriptor(id, descriptor)
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
        let baseUrl = descriptor.dataPort?.baseUrl ?? DEFAULT_BASE_URL
        if (baseUrl === '') {
            baseUrl = DEFAULT_BASE_URL
        }
        let id = descriptor.dataPort?.identifier
        if (id === undefined || id === '') {
            const idResult = await this._client.getId()
            if (idResult.isErr()) return err(idResult._unsafeUnwrapErr())
            id = idResult._unsafeUnwrap()
        }
        const result = await this._client.uploadCraftData(
            id,
            data._unsafeUnwrap()
        )
        if (result.isErr()) return err(result._unsafeUnwrapErr())
        return ok(undefined)
    }

    /**
     * Download descriptor from url.
     */
    async downloadDescriptorFromUrl(
        sheetIdx: number,
        masterRow: number,
        masterCol: number,
        url: string
    ): ResultAsync<readonly Payload[]> {
        const descriptorResult = await this._client.downloadDescriptor(url)
        if (descriptorResult.isErr())
            return err(descriptorResult._unsafeUnwrapErr())

        const urlObj = new URL(url)

        let id = ''
        if (!this._client.isSameHost(url)) {
            const idResult = await this._client.getId()
            if (idResult.isErr()) return err(idResult._unsafeUnwrapErr())
            id = idResult._unsafeUnwrap()
        } else {
            id = urlObj.pathname.split('/').pop()!
        }

        const descriptor = descriptorResult._unsafeUnwrap()
        descriptor.dataPort!.identifier = id
        const blockIdResult = await this._workbookClient.getAvailableBlockId({
            sheetIdx: sheetIdx,
        })
        if (isErrorMessage(blockIdResult))
            return err(workbookError(blockIdResult.msg))
        const sheetId = await this._workbookClient.getSheetId({
            sheetIdx: sheetIdx,
        })
        if (isErrorMessage(sheetId)) return err(workbookError(sheetId.msg))
        const blockId = blockIdResult
        const key = blockIdToString([sheetId, blockId])
        this._craftDescriptors.set(key, descriptor)
        return ok(
            generatePayloads(
                sheetIdx,
                blockId,
                masterRow,
                masterCol,
                descriptor
            )
        )
    }

    async downloadCraftData(blockId: BlockId): ResultAsync<readonly Payload[]> {
        const descriptorResult = this.getCraftDescriptor(blockId)
        if (descriptorResult.isErr())
            return err(descriptorResult._unsafeUnwrapErr())
        const descriptor = descriptorResult._unsafeUnwrap()
        const id = descriptor?.dataPort?.identifier
        if (id === undefined || id === '') {
            return err(descriptorNotFound(blockId[0], blockId[1]))
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
        const dataResult = await this._client.downloadCraftData(id)
        if (dataResult.isErr()) return err(dataResult._unsafeUnwrapErr())
        const data = dataResult._unsafeUnwrap()

        const sheetIdx = await this._workbookClient.getSheetIdx({
            sheetId: blockId[0],
        })
        if (isErrorMessage(sheetIdx)) return err(workbookError(sheetIdx.msg))
        const newRowCnt =
            data.flatMap((v) => v.values).length + descriptorRowSize
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
        const fieldKeyValue = new Map<string, Value>()
        const getKey = (key: string, field: string) =>
            `${key}_?@logisheets#!_${field}`
        data.flatMap((v) => v.values).forEach((v) => {
            const key = v.key
            const field = v.field
            const value = v.value
            fieldKeyValue.set(getKey(key, field), value)
            if (keyArray.includes(key)) return
            keyArray.push(key)
        })

        for (
            let r = dataArea.startRow;
            r <= (dataArea.endRow ?? newRowCnt - 1);
            r++
        ) {
            const idx = r - dataArea.startRow
            if (idx >= keyArray.length) break
            const key = keyArray[idx]
            const row = masterRow + r
            for (
                let c = dataArea.startCol;
                c <= (dataArea.endCol ?? info.colCnt - 1);
                c++
            ) {
                const col = masterCol + c
                const f = fieldMap.get(c)
                if (f === undefined) continue
                const v = fieldKeyValue.get(getKey(key, f[0]))
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
                        .content(CellValue.from(v).valueStr)
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
    ): Promise<Map<number, [string, string]>> {
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
        const fieldMAp = new Map<number, [string, string]>()
        for (let i = dataArea.startCol; i <= endCol; i++) {
            const appendix = await this._workbookClient.lookupAppendixUpward({
                sheetId: blockId[0],
                blockId: blockId[1],
                row: dataArea.startRow,
                col: i,
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
            fieldMAp.set(appendix.colIdx, [vStr, appendix.appendix.content])
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
                const i = c + r * colCount
                const cell = cells[i]
                const field = fieldMap.get(c + dataArea.startCol)
                if (field === undefined) continue
                let key = keyMap.get(r + dataArea.startRow)
                if (key === undefined) {
                    key = ''
                }
                if (cell.value === 'empty' && key === '') continue
                const v: CraftValue = {
                    key,
                    field: field[0],
                    value: cell.value,
                }
                result.push(v)
            }
        }
        return ok({values: result})
    }

    public getPersistentData(blockFields: readonly BlockField[]): string {
        const fieldInfos: FieldInfo[] = []
        blockFields.forEach((f) => {
            const info = this.fieldManager.get(f.sheetId, f.blockId, f.fieldId)
            if (info === undefined) return
            fieldInfos.push(info)
        })
        const fieldInfosJson = JSON.stringify(fieldInfos)
        const enumSetJson = this.enumSetManager.toJSON()

        return `{fields: ${fieldInfosJson}, enumSets: ${enumSetJson}}`
    }

    public async getId(): ResultAsync<string> {
        return this._client.getId()
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
    private _client = new ClientImpl(DEFAULT_BASE_URL)
}

function blockIdToString(blockId: BlockId) {
    return `${blockId[0]}-${blockId[1]}`
}
