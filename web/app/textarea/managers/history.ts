import {Texts} from './texts'
export class History {
    init(): void {
        this._undo = []
        this._redo = []
    }

    add(texts: Texts): void {
        this._undo.push(texts)
        this._redo = []
    }

    undo(): Texts | undefined {
        const u = this._undo.pop()
        if (u !== undefined)
            this._redo.push(u)
        return u
    }

    redo(): Texts | undefined {
        const r = this._redo.pop()
        if (r !== undefined)
            this._undo.push(r)
        return r
    }
    // tslint:disable-next-line: readonly-array
    private _undo: Texts[] = []
    // tslint:disable-next-line: readonly-array
    private _redo: Texts[] = []
}
