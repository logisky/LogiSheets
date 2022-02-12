export const enum ErrorNodeType {
    UNSPECIFIED,
    LEX,
}
export class ErrorNode {
    constructor(
        public msg = ''
    ) {}
    public type = ErrorNodeType.UNSPECIFIED
}

export function isErrorNode(obj: unknown): obj is ErrorNode {
    return obj instanceof ErrorNode
}
