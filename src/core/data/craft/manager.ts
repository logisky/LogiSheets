import {injectable} from 'inversify'
import {BlockId, CraftId, CraftState, MethodName} from 'logisheets-craft-forge'
import {WorkbookClient} from '../workbook'
import {CraftHandler} from './handler'
import {isErrorMessage} from 'packages/web'

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

export enum DiyButtonType {
    Upload1,
}

export interface DiyButton {
    type: DiyButtonType
    dirCellId: number
}

export interface CraftConfig {
    buttons: readonly DiyButton[]
    url: string
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
        if (this._blockToCraft.has(blockId)) {
            throw new Error(
                `Block with id ${blockId} already bound to craft ${this._blockToCraft.get(
                    blockId
                )}`
            )
        }
        this._blockToCraft.set(blockId, craftId)
    }

    public async openIframeForBlock(blockId: BlockId): Promise<void> {
        if (this._currentBlockId && this._dirty) {
            // The current block id state is dirty. We should update it first.
            const state = await this._handler.getCraftState(
                this._currentBlockId
            )
            this._craftStates.set(this._currentBlockId, state)
        }

        if (!this._blockToCraft.has(blockId))
            throw Error('block id has not been binded')
        const craftId = this._blockToCraft.get(blockId)

        const state = this._craftStates.get(blockId)
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
    async extractBlockValues(
        blockId: BlockId
    ): Promise<{key: string; field: string; value: string}[]> {
        const state = this._craftStates.get(blockId)
        if (!state) throw Error('craft has not been registered')

        const keyMap: Map<string, number> = new Map()
        const fieldMap: Map<string, number> = new Map()
        state.coordinateBinds.forEach((bind) => {
            if (bind.isKey) {
                keyMap.set(bind.name, bind.value)
            } else {
                fieldMap.set(bind.name, bind.value)
            }
        })

        const values: Map<[string, string], string> = new Map()
        for (const [keyName, key] of keyMap) {
            for (const [fieldName, field] of fieldMap) {
                const value = await this._workbookClient.getCell({
                    sheetIdx: blockId[0],
                    row: key,
                    col: field,
                })
                if (isErrorMessage(value)) throw Error(value.msg)
                values.set([keyName, fieldName], value.getText())
            }
        }

        const result = Array.from(values.entries()).map(([k, v]) => ({
            key: k[0],
            field: k[1],
            value: v,
        }))

        return result
    }

    async onDiyCellClick(id: number): Promise<void> {
        const blockId = this._diyIds.get(id)
        if (!blockId) {
            // eslint-disable-next-line no-console
            console.log(id + ' is not registered')
            return
        }

        const config = this._configs.get(blockId)
        if (!config) {
            // eslint-disable-next-line no-console
            console.log(id + ' is not registered')
            return
        }

        const button = config.buttons.find((each) => each.dirCellId === id)
        if (!button) {
            // eslint-disable-next-line no-console
            console.log(id + ' is not registered')
            return
        }
        if (button.type === DiyButtonType.Upload1) {
            const values = await this.extractBlockValues(blockId)
            const url = config.url
            await fetch(url, {
                method: 'POST',
                body: JSON.stringify(values),
                headers: {
                    'Content-Type': 'application/json',
                },
            })

            return
        }
        throw Error('unimplemented!')
    }

    private _crafts: CraftManifest[] = []
    private _blockToCraft: Map<BlockId, CraftId> = new Map()
    private _craftStates: Map<BlockId, CraftState> = new Map()
    private _iframe!: HTMLIFrameElement
    private _handler: CraftHandler

    private _configs: Map<BlockId, CraftConfig> = new Map()
    private _diyIds: Map<number, BlockId> = new Map()

    private _currentBlockId: BlockId | undefined
    private _dirty = false
}
