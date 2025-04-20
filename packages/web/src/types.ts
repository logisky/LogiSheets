import {Payload} from './payloads'

export type RowId = number
export type ColId = number

export class Transaction {
    public constructor(
        public payloads: readonly Payload[],
        public readonly undoable: boolean
    ) {}
}

export class TransactionBuilder {
    public payload(p: Payload): this {
        this._payloads.push(p)
        return this
    }

    public undoable(v: boolean): this {
        this._undoable = v
        return this
    }

    public build(): Transaction {
        return new Transaction(this._payloads, this._undoable)
    }

    private _payloads: Payload[] = []
    private _undoable = true
}
