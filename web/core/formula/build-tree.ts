import {
    create as createShuntingYard,
    Operator,
    SENTINEL,
    ShuntingYard,
} from './shuntting-yard'
import {createTokenStream, TokenStreamType} from './token-stream'
import {
    BinaryExpression,
    Cell,
    CellRange,
    CellRefType,
    FormulaNode,
    FunctionNode,
    Logical,
    NumberNode,
    Text,
    UnaryExpression,
    UnknownNode,
} from './node-builder'
import {Token} from './lex'
import {ErrorNode, ErrorNodeBuilder, isErrorNode} from './error'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function parseFormula(tokens: readonly Token[]) {
    const stream = createTokenStream(tokens)
    const shuntingYard = createShuntingYard()

    const err = parseExpression(stream, shuntingYard)
    if (isErrorNode(err))
        return err

    const retVal = shuntingYard.operands.top()
    if (!retVal)
        return new ErrorNodeBuilder().msg('Syntax error').build()
    return retVal
}

function parseExpression(stream: TokenStreamType, shuntingYard: ShuntingYard) {
    const e = parseOperandExpression(stream, shuntingYard)
    if (isErrorNode(e))
        return e

    let pos
    while (stream.nextIsBinaryOperator()) {
        if (pos === stream.pos())
            return new ErrorNodeBuilder().msg('Syntax error').build()
        pos = stream.pos()
        const op = createBinaryOperator(stream.getNext().value)
        if (isErrorNode(op))
            return op
        pushOperator(op, shuntingYard)
        stream.consume()
        const e = parseOperandExpression(stream, shuntingYard)
        if (isErrorNode(e))
            return e
    }

    while (shuntingYard.operators.top() !== SENTINEL)
        popOperator(shuntingYard)
    return
}

function parseOperandExpression(
    stream: TokenStreamType,
    shuntingYard: ShuntingYard
): ErrorNode | void {
    if (stream.nextIsTerminal())
        shuntingYard.operands.push(parseTerminal(stream))
        // parseTerminal already consumes once so don't need to consume on line below
        // stream.consume()
    else if (stream.nextIsOpenParen()) {
        stream.consume() // open paren
        const e = withinSentinel(shuntingYard, function () {
            parseExpression(stream, shuntingYard)
        })
        if (isErrorNode(e))
            return e
        stream.consume() // close paren
    } else if (stream.nextIsPrefixOperator()) {
        const unaryOperator = createUnaryOperator(stream.getNext().value)
        if (isErrorNode(unaryOperator))
            return unaryOperator
        pushOperator(unaryOperator, shuntingYard)
        stream.consume()
        const err = parseOperandExpression(stream, shuntingYard)
        if (isErrorNode(err))
            return err
    } else if (stream.nextIsFunctionCall())
        parseFunctionCall(stream, shuntingYard)
    return
}

function parseFunctionCall(
    stream: TokenStreamType,
    shuntingYard: ShuntingYard
) {
    const name = stream.getNext().value
    stream.consume() // consume start of function call

    const args = parseFunctionArgList(stream, shuntingYard)
    if (isErrorNode(args))
        return args
    const f = new FunctionNode(name, args)
    shuntingYard.operands.push(f)

    stream.consume() // consume end of function call
    return
}

function parseFunctionArgList(
    stream: TokenStreamType,
    shuntingYard: ShuntingYard
) {
    const reverseArgs: FormulaNode[] = []

    const e = withinSentinel(shuntingYard, () => {
        let arity = 0
        let pos
        while (!stream.nextIsEndOfFunctionCall()) {
            if (pos === stream.pos())
                return new ErrorNodeBuilder().msg('Invalid syntax').build()
            pos = stream.pos()
            parseExpression(stream, shuntingYard)
            arity += 1

            if (stream.nextIsFunctionArgumentSeparator())
                stream.consume()
        }

        for (let i = 0; i < arity; i++) {
            const o = shuntingYard.operands.pop()
            if (o === undefined)
                continue
            reverseArgs.push(o)
        }
        return
    })
    if (isErrorNode(e))
        return e

    return reverseArgs.reverse()
}

function withinSentinel(
    shuntingYard: ShuntingYard,
    fn: () => void | ErrorNode
) {
    shuntingYard.operators.push(SENTINEL)
    const e = fn()
    shuntingYard.operators.pop()
    return e
}

function pushOperator(operator: Operator, shuntingYard: ShuntingYard) {
    while (shuntingYard.operators.top()?.evaluatesBefore(operator))
        popOperator(shuntingYard)
    shuntingYard.operators.push(operator)
}

function popOperator({operators, operands}: ShuntingYard) {
    if (operators.top()?.isBinary()) {
        const right = operands.pop()
        const left = operands.pop()
        const operator = operators.pop()
        if (operator === undefined || left === undefined || right === undefined)
            return
        const b = new BinaryExpression(operator.symbol, left, right)
        operands.push(b)
    } else if (operators.top()?.isUnary()) {
        const operand = operands.pop()
        const operator = operators.pop()
        if (operator === undefined || operand === undefined)
            return
        const u = new UnaryExpression(operator.symbol, operand)
        operands.push(u)
    }
}

function parseTerminal(stream: TokenStreamType) {
    if (stream.nextIsNumber())
        return parseNumber(stream)

    if (stream.nextIsText())
        return parseText(stream)

    if (stream.nextIsLogical())
        return parseLogical(stream)

    if (stream.nextIsRange())
        return parseRange(stream)
    return new UnknownNode()
}

function parseRange(stream: TokenStreamType) {
    const next = stream.getNext()
    stream.consume()
    return createCellRange(next.value)
}

function createCellRange(value: string) {
    const parts = value.split(':')

    if (parts.length == 2)
        return new CellRange(
            new Cell(cellRefType(parts[0]), parts[0]),
            new Cell(cellRefType(parts[1]), parts[1])
        )

    return new Cell(cellRefType(value), value)
}

function cellRefType(key: string): CellRefType {
    if (/^\$[A-Z]+\$\d+$/.test(key)
        || /^\$[A-Z]+$/ .test(key)
        || /^\$\d+$/ .test(key))
        return CellRefType.ABSOLUTE
    if (/^\$[A-Z]+\d+$/ .test(key)
        || /^[A-Z]+\$\d+$/ .test(key))
        return CellRefType.MIXED
    if (/^[A-Z]+\d+$/ .test(key)
        || /^\d+$/ .test(key)
        || /^[A-Z]+$/ .test(key))
        return CellRefType.RELATIVE
    return CellRefType.UNSPECIFIED
}

function parseText(stream: TokenStreamType) {
    const next = stream.getNext()
    stream.consume()
    return new Text(next.value)
}

function parseLogical(stream: TokenStreamType) {
    const next = stream.getNext()
    stream.consume()
    return new Logical(next.value === 'TRUE')
}

function parseNumber(stream: TokenStreamType) {
    let value = Number(stream.getNext().value)
    stream.consume()

    if (stream.nextIsPostfixOperator()) {
        value *= 0.01
        stream.consume()
    }
    return new NumberNode(value)
}

function createUnaryOperator(symbol: string) {
    const precendence = {
        // negation
        '-': 7,
    }[symbol]
    if (precendence === undefined)
        return new ErrorNodeBuilder()
            .msg(`unsupport operator ${symbol}`)
            .build()
    return new Operator(symbol, precendence, 1, true)
}

function createBinaryOperator(symbol: string) {
    const precendence = {
        // cell range union and intersect
        ' ': 8,
        ',': 8,
        // raise to power
        '^': 5,
        // multiply, divide
        '*': 4,
        '/': 4,
        // add, subtract
        '+': 3,
        '-': 3,
        // string concat
        '&': 2,
        // comparison
        '=': 1,
        '<>': 1,
        '<=': 1,
        '>=': 1,
        '>': 1,
        '<': 1,
    }[symbol]
    if (precendence === undefined)
        return new ErrorNodeBuilder()
            .msg(`unsupport operator ${symbol}`)
            .build()

    return new Operator(symbol, precendence, 2, true)
}
