import { Payload } from "./payloads";

export class UndoTransaction {
    public static type = 'undo'
}

export class RedoTransaction {

    public static type = 'redo'
}


export class PayloadsTransaction {
    public constructor(
        payloads: Payload[],
        public readonly undoable: boolean,
    ) {
        this.payloads = payloads
    }

    public static type = 'payloads'

    public addPayload(p: Payload): void {
        this.payloads.push(p)
    }

    public payloads: Payload[] = []
}

export type Transaction =
    | UndoTransaction
    | RedoTransaction
    | PayloadsTransaction
