export class BlockManager {
    public constructor(
        checkBindBlock: (
            sheetIdx: number,
            blockId: number,
            rowCount: number,
            colCount: number
        ) => boolean,
        getAvailableBlockId: (sheetIdx: number) => number
    ) {
        this._checkBindBlock = checkBindBlock
        this._getAvailableBlockId = getAvailableBlockId
    }

    /**
     * Todo: make sure that the block/craft will never be changed by other
     * crafts.
     */
    public bindBlock(
        sheetIdx: number,
        blockId: number,
        rowCount: number,
        colCount: number
    ): boolean {
        return this._checkBindBlock(sheetIdx, blockId, rowCount, colCount)
    }

    /**
     * This function should only find the greatest block id when the available block id
     * has been set. After that, it will always use the cached value.
     * This means that every time you call this function after initialization,
     * it will return a new block id. It will lead to the waste of block ids if you don't create
     * a block with this id.
     *
     * Block id is `usize` in `WASM` side. It should be enough for most cases even we waste some of the ids.
     */
    public getAvailableBlockId(sheetIdx: number): number {
        if (this.sheetAvailableBlockIds.has(sheetIdx)) {
            const result = this.sheetAvailableBlockIds.get(sheetIdx)!
            this.sheetAvailableBlockIds.set(sheetIdx, result + 1)
            return result
        }
        const id = this._getAvailableBlockId(sheetIdx)
        this.sheetAvailableBlockIds.set(sheetIdx, id)
        return id
    }

    private sheetAvailableBlockIds: Map<number, number> = new Map()

    private _checkBindBlock: (
        sheetIdx: number,
        blockId: number,
        rowCount: number,
        colCount: number
    ) => boolean

    private _getAvailableBlockId: (sheetIdx: number) => number
}
