import {FormulaNode} from './node-builder'

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
export class Operator {
    constructor(
        private readonly _symbol: string,
        private readonly _precendence: number,
        private readonly _operandCount = 2,
        private readonly _leftAssociative = true,
    ) {
        if (_operandCount < 1 || _operandCount > 2)
            throw new Error(`operandCount cannot be ${_operandCount}, must be 1 or 2`)
    }
    get symbol(): string {
        return this._symbol
    }

    isUnary() {
        return this._operandCount === 1
    }

    isBinary() {
        return this._operandCount === 2
    }

    evaluatesBefore(other: Operator) {
        if (this === SENTINEL)
            return false
        if (other === SENTINEL)
            return true
        if (other.isUnary())
            return false

        if (this.isUnary())
            return this._precendence >= other._precendence
        if (this.isBinary()) {
            if (this._precendence === other._precendence)
                return this._leftAssociative
            return this._precendence > other._precendence
        }
        return false
    }
}
// fake operator with lowest precendence
export const SENTINEL = new Operator('S', 0)

export class Stack<T> {
    push(value: T) {
        this._items.push(value)
    }

    pop() {
        return this._items.pop()
    }

    top(): T | undefined {
        if (this._items.length === 0)
            return
        return this._items[this._items.length - 1]
    }
    // tslint:disable-next-line: readonly-array
    private _items: T[] = []
}

export type ShuntingYard = ReturnType<typeof create>
export function create() {
    const operands = new Stack<FormulaNode>()
    const operators = new Stack<Operator>()

    operators.push(SENTINEL)

    return {
        operands,
        operators,
    }
}
