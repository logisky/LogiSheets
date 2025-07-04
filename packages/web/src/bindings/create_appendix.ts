// DO NOT EDIT. CODE GENERATED BY gents.
export interface CreateAppendix {
    type: 'createAppendix'
    sheetId?: number
    sheetIdx?: number
    blockId: number
    rowIdx: number
    colIdx: number
    craftId: string
    tag: number
    content: string
}

export class CreateAppendixBuilder {
    private _type = 'createAppendix'
    private _sheetId?: number
    private _sheetIdx?: number
    private _blockId!: number
    private _rowIdx!: number
    private _colIdx!: number
    private _craftId!: string
    private _tag!: number
    private _content!: string
    public sheetId(value: number) {
        this._sheetId = value
        return this
    }

    public sheetIdx(value: number) {
        this._sheetIdx = value
        return this
    }

    public blockId(value: number) {
        this._blockId = value
        return this
    }

    public rowIdx(value: number) {
        this._rowIdx = value
        return this
    }

    public colIdx(value: number) {
        this._colIdx = value
        return this
    }

    public craftId(value: string) {
        this._craftId = value
        return this
    }

    public tag(value: number) {
        this._tag = value
        return this
    }

    public content(value: string) {
        this._content = value
        return this
    }

    public build() {
        if (this._blockId === undefined) throw new Error('missing blockId')
        if (this._rowIdx === undefined) throw new Error('missing rowIdx')
        if (this._colIdx === undefined) throw new Error('missing colIdx')
        if (this._craftId === undefined) throw new Error('missing craftId')
        if (this._tag === undefined) throw new Error('missing tag')
        if (this._content === undefined) throw new Error('missing content')
        return {
            type: this._type,
            sheetId: this._sheetId,
            sheetIdx: this._sheetIdx,
            blockId: this._blockId,
            rowIdx: this._rowIdx,
            colIdx: this._colIdx,
            craftId: this._craftId,
            tag: this._tag,
            content: this._content
        }
    }
}
