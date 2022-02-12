/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {ErrorNode} from './error'
import {
    isBinaryExpression,
    isCell,
    isCellRange,
    isFunction,
    isLogical,
    isNumberNode,
    isText,
    isUnaryExpression,
    BinaryExpression,
    Cell,
    CellRange,
    FormulaNode,
    FunctionNode,
    Logical,
    NumberNode,
    Text,
    UnaryExpression,
} from './node-builder'
export interface Visitor {
    readonly enterCell?: (node: FormulaNode) => void
    readonly exitCell?: (node: FormulaNode) => void

    readonly enterCellRange?: (node: FormulaNode) => void
    readonly exitCellRange?: (node: FormulaNode) => void

    readonly enterFunction?: (node: FormulaNode) => void
    readonly exitFunction?: (node: FormulaNode) => void

    readonly enterNumber?: (node: FormulaNode) => void
    readonly exitNumber?: (node: FormulaNode) => void

    readonly enterText?: (node: FormulaNode) => void
    readonly exitText?: (node: FormulaNode) => void

    readonly enterLogical?: (node: FormulaNode) => void
    readonly exitLogical?: (node: FormulaNode) => void

    enterBinaryExpression(node: FormulaNode): void
    exitBinaryExpression(node: FormulaNode): void

    enterUnaryExpression(node: FormulaNode): void
    exitUnaryExpression(node: FormulaNode): void
  }
export function visit(node: FormulaNode, visitor: Visitor) {
    return visitNode(node, visitor)
}

function visitNode(node: FormulaNode, visitor: Visitor) {
    if (isCell(node))
        return visitCell(node, visitor)
    if (isCellRange(node))
        return visitCellRange(node, visitor)
    if (isFunction(node))
        return visitFunction(node, visitor)
    if (isNumberNode(node))
        return visitNumber(node, visitor)
    if (isText(node))
        return visitText(node, visitor)
    if (isLogical(node))
        return visitLogical(node, visitor)
    if (isBinaryExpression(node))
        return visitBinaryExpression(node, visitor)
    if (isUnaryExpression(node))
        return visitUnaryExpression(node, visitor)
    return new ErrorNode(`unsupport type ${node.type}`)
}

function visitCell(node: Cell, visitor: Visitor) {
    if (visitor.enterCell) visitor.enterCell(node)
    if (visitor.exitCell) visitor.exitCell(node)
}

function visitCellRange(node: CellRange, visitor: Visitor){
    if (visitor.enterCellRange) visitor.enterCellRange(node)

    visitNode(node.left, visitor)
    visitNode(node.right, visitor)

    if (visitor.exitCellRange) visitor.exitCellRange(node)
}

function visitFunction(node: FunctionNode, visitor: Visitor){
    if (visitor.enterFunction) visitor.enterFunction(node)

    node.args.forEach(arg => visitNode(arg, visitor))

    if (visitor.exitFunction) visitor.exitFunction(node)
}

function visitNumber(node: NumberNode, visitor: Visitor){
    if (visitor.enterNumber) visitor.enterNumber(node)
    if (visitor.exitNumber) visitor.exitNumber(node)
}

function visitText(node: Text, visitor: Visitor){
    if (visitor.enterText) visitor.enterText(node)
    if (visitor.exitText) visitor.exitText(node)
}

function visitLogical(node: Logical, visitor: Visitor){
    if (visitor.enterLogical) visitor.enterLogical(node)
    if (visitor.exitLogical) visitor.exitLogical(node)
}

function visitBinaryExpression(node: BinaryExpression, visitor: Visitor){
    if (visitor.enterBinaryExpression) visitor.enterBinaryExpression(node)

    visitNode(node.left, visitor)
    visitNode(node.right, visitor)

    if (visitor.exitBinaryExpression) visitor.exitBinaryExpression(node)
}

function visitUnaryExpression(node: UnaryExpression, visitor: Visitor){
    if (visitor.enterUnaryExpression) visitor.enterUnaryExpression(node)

    visitNode(node.operand, visitor)

    if (visitor.exitUnaryExpression) visitor.exitUnaryExpression(node)
}
