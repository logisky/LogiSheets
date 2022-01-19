import {parseFormula} from './build-tree'
import {tokenize} from './lex'
import {FormulaNode} from './node-builder'
import {ErrorNode} from './error'
export function parse(formula: string): FormulaNode | ErrorNode {
    return parseFormula(tokenize(formula))
}
