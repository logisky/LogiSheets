export interface CreateAppendix {
    readonly type: 'createAppendix'
    readonly sheetId: number
    readonly blockId: number
    readonly rowIdx: number
    readonly colIdx: number
    readonly craftId: string
    readonly tag: number
    readonly content: string
}

export class CreateAppendixBuilder {
    private _sheetId?: number
    private _blockId?: number
    private _rowIdx?: number
    private _colIdx?: number
    private _craftId?: string
    private _tag?: number
    private _content?: string

    public sheetId(sheetId: number): this {
        this._sheetId = sheetId
        return this
    }

    public blockId(blockId: number): this {
        this._blockId = blockId
        return this
    }

    public rowIdx(rowIdx: number): this {
        this._rowIdx = rowIdx
        return this
    }

    public colIdx(colIdx: number): this {
        this._colIdx = colIdx
        return this
    }

    public craftId(craftId: string): this {
        this._craftId = craftId
        return this
    }

    public tag(tag: number): this {
        this._tag = tag
        return this
    }

    public content(content: string): this {
        this._content = content
        return this
    }

    public build(): CreateAppendix {
        if (this._sheetId === undefined) {
            throw new Error('sheetId is undefined')
        }
        if (this._blockId === undefined) {
            throw new Error('blockId is undefined')
        }
        if (this._rowIdx === undefined) {
            throw new Error('rowIdx is undefined')
        }
        if (this._colIdx === undefined) {
            throw new Error('colIdx is undefined')
        }
        if (this._craftId === undefined) {
            throw new Error('craftId is undefined')
        }
        if (this._tag === undefined) {
            throw new Error('tag is undefined')
        }
        if (this._content === undefined) {
            throw new Error('content is undefined')
        }
        return {
            type: 'createAppendix',
            sheetId: this._sheetId,
            blockId: this._blockId,
            rowIdx: this._rowIdx,
            colIdx: this._colIdx,
            craftId: this._craftId,
            tag: this._tag,
            content: this._content,
        }
    }
}
