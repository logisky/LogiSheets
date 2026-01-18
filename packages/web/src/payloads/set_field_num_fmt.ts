export interface SetFieldNumFmt {
    readonly renderId: string
    readonly numFmt: string
    readonly diyRender: boolean
}

export class SetFieldNumFmtBuilder {
    private _renderId?: string
    private _numFmt?: string
    private _diyRender?: boolean

    public renderId(renderId: string): this {
        this._renderId = renderId
        return this
    }

    public numFmt(numFmt: string): this {
        this._numFmt = numFmt
        return this
    }

    public diyRender(diyRender: boolean): this {
        this._diyRender = diyRender
        return this
    }

    public build(): SetFieldNumFmt {
        if (this._renderId === undefined) throw Error('renderId is undefined!')
        if (this._numFmt === undefined) throw Error('numFmt is undefined!')
        if (this._diyRender === undefined)
            throw Error('diyRender is undefined!')
        return {
            renderId: this._renderId,
            numFmt: this._numFmt,
            diyRender: this._diyRender,
        }
    }
}
