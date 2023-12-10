export interface SheetRename {
    readonly type: 'sheetRename'
    readonly oldName?: string
    readonly idx?: number
    readonly newName: string
}

export class SheetRenameBuilder {
    private _oldName?: string
    private _newName?: string
    private _idx?: number
    public oldName(oldName: string): this {
        this._oldName = oldName
        return this
    }
    public newName(newName: string): this {
        this._newName = newName
        return this
    }
    public idx(idx: number): this {
        this._idx = idx
        return this
    }
    public build(): SheetRename {
        if (this._newName === undefined) throw Error('newName is undefined!')
        if (this._idx === undefined && this._oldName === undefined)
            throw Error('neither sheetIdx or oldName is defined')
        return {
            type: 'sheetRename',
            oldName: this._oldName,
            newName: this._newName,
            idx: this._idx,
        }
    }
}
