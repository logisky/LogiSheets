export interface SheetRename {
    readonly type: 'sheetRename'
    readonly oldName: string
    readonly newName: string
}

export class SheetRenameBuilder {
    private _oldName?: string
    private _newName?: string
    public oldName(oldName: string): this {
        this._oldName = oldName
        return this
    }
    public newName(newName: string): this {
        this._newName = newName
        return this
    }
    public build(): SheetRename {
        if (this._oldName === undefined) throw Error('oldName is undefined!')
        if (this._newName === undefined) throw Error('newName is undefined!')
        return {
            type: 'sheetRename',
            oldName: this._oldName,
            newName: this._newName,
        }
    }
}
