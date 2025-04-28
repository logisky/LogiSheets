import {injectable} from 'inversify'
import {
    BlockId,
    CraftId,
    CraftState,
    LoadCraftStateMethodName,
} from 'logisheets-craft'
import {WorkbookClient} from '../workbook'
import {CraftHandler} from './handler'

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

    public openIframeForBlock(blockId: BlockId): Promise<void> {
        if (!this._blockToCraft.has(blockId))
            throw Error('block id has not been binded')
        const craftId = this._blockToCraft.get(blockId)

        const state = this._craftStates.get(blockId)
        const manifest = this._crafts.find((v) => v.id === craftId)
        if (!manifest) throw Error('craft has not been registered')
        this._iframe.src = manifest?.html
        const message = {
            m: LoadCraftStateMethodName,
            toBlock: blockId,
            state,
        }
        return new Promise((resolve) => {
            const callback = (e: MessageEvent) => {
                if (e.data.m === LoadCraftStateMethodName) {
                    resolve()
                    window.removeEventListener('message', callback)
                }
            }
            window.addEventListener('message', callback)
            this._iframe.contentWindow?.postMessage(message, '*')
        })
    }

    public activateCraft(craftId: CraftId) {
        const craft = this._crafts.find((each) => each.id === craftId)
        if (!craft) {
            throw new Error(`Craft with id ${craftId} not found`)
        }
        const iframe = document.createElement('iframe')
        iframe.src = craft.html
        iframe.style.width = '100%'
        iframe.style.height = '100%'
        return iframe
    }

    private _crafts: CraftManifest[] = []
    private _blockToCraft: Map<BlockId, CraftId> = new Map()
    private _craftStates: Map<BlockId, CraftState> = new Map()
    private _iframe!: HTMLIFrameElement
    private _handler: CraftHandler
}
