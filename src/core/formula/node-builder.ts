// tslint:disable: unknown-paramenter-for-type-predicate
export const enum FormulaNodeType {
    UNSPECIFIED,
    CELL,
    CELL_RANGE,
    FUNCTION,
    NUMBER,
    TEXT,
    LOGICAL,
    BINARY_EXPRESSION,
    UNARY_EXPRESSION,
}
export const enum CellRefType {
    UNSPECIFIED,
    ABSOLUTE,
    MIXED,
    RELATIVE,
}
export interface FormulaNode {
    readonly type: FormulaNodeType
}
export function isCell(node: FormulaNode): node is Cell {
    return node.type === FormulaNodeType.CELL
}

export function isCellRange(node: FormulaNode): node is CellRange {
    return node.type === FormulaNodeType.CELL_RANGE
}

export function isFunction(node: FormulaNode): node is FunctionNode {
    return node.type === FormulaNodeType.FUNCTION
}

export function isNumberNode(node: FormulaNode): node is NumberNode {
    return node.type === FormulaNodeType.NUMBER
}

export function isText(node: FormulaNode): node is Text {
    return node.type === FormulaNodeType.TEXT
}

export function isLogical(node: FormulaNode): node is Logical {
    return node.type === FormulaNodeType.LOGICAL
}

export function isBinaryExpression(
    node: FormulaNode
): node is BinaryExpression {
    return node.type === FormulaNodeType.BINARY_EXPRESSION
}

export function isUnaryExpression(node: FormulaNode): node is UnaryExpression {
    return node.type === FormulaNodeType.UNARY_EXPRESSION
}
export class UnknownNode implements FormulaNode {
    type = FormulaNodeType.UNSPECIFIED
}
export class Cell implements FormulaNode {
    constructor(
        public readonly refType: CellRefType,
        public readonly key: string,
    ) {}
    type = FormulaNodeType.CELL
}
export class CellRange implements FormulaNode {
    constructor(
        public readonly left: Cell,
        public readonly right: Cell,
    ) {}
    type = FormulaNodeType.CELL_RANGE
}

export class FunctionNode implements FormulaNode {
    constructor(
        public readonly name: string,
        public readonly args: readonly FormulaNode[],
    ) {}
    type = FormulaNodeType.FUNCTION
}

export class NumberNode implements FormulaNode {
    constructor(
        public readonly value: number | string,
    ) {}
    get number(): number {
        return Number(this.value)
    }
    type = FormulaNodeType.NUMBER
}

export class Text implements FormulaNode {
    constructor(
        public readonly value: string,
    ) {}
    type = FormulaNodeType.TEXT
}

export class Logical implements FormulaNode {
    constructor(
        public readonly value: boolean,
    ) {}
    type = FormulaNodeType.LOGICAL
}

// 二元表达式
export class BinaryExpression implements FormulaNode {
    constructor(
        public readonly operator: string,
        public readonly left: FormulaNode,
        public readonly right: FormulaNode,
    ) {}
    type = FormulaNodeType.BINARY_EXPRESSION
}

// 一元表达式
export class UnaryExpression implements FormulaNode {
    constructor(
        public readonly operator: string,
        public readonly operand: FormulaNode,
    ) {}
    type = FormulaNodeType.UNARY_EXPRESSION
}
