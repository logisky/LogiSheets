import {injectable} from 'inversify'

export interface CraftManifest {
    /**
     * The craft's unique identifier.
     */
    id: string
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
    public constructor() {}

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
    public bindBlock(blockId: number, craftId: string) {
        if (this._blockToCraft.has(blockId)) {
            throw new Error(
                `Block with id ${blockId} already bound to craft ${this._blockToCraft.get(
                    blockId
                )}`
            )
        }
        this._blockToCraft.set(blockId, craftId)
    }

    public activateCraft(craftId: string): HTMLIFrameElement {
        const craft = this._crafts.find((each) => each.id === craftId)
        if (!craft) {
            throw new Error(`Craft with id ${craftId} not found`)
        }

        return this.createCraftIframe(craftId)
    }

    public createCraftIframe(craftId: string) {
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
    private _blockToCraft: Map<number, string> = new Map()
}
