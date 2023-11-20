import {Payload} from './payloads'

export class Transaction {
    public constructor(payloads: Payload[], public readonly undoable: boolean) {
        this.payloads = payloads
    }

    public addPayload(p: Payload): Transaction {
        this.payloads.push(p)
        return this
    }

    public payloads: Payload[] = []
}
