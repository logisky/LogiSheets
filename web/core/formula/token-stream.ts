/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {ErrorNodeBuilder} from './error'
import {Token, SubType, TokenType, TokenBuilder} from './lex'
export type TokenStreamType = ReturnType<typeof createTokenStream>
// tslint:disable-next-line: max-func-body-length
export function createTokenStream(tokens: readonly Token[]) {
    const end = new TokenBuilder().build()
    const arr = [...tokens, end]
    let index = 0

    return {
        consume() {
            index += 1
            if (index >= arr.length)
                return new ErrorNodeBuilder().msg('Invalid Syntax').build()
            return
        },

        getNext() {
            return arr[index]
        },

        nextIs(
            type: TokenType,
            subtype: SubType = SubType.UNSPECIFIED
        ): boolean {
            if (this.getNext().type !== type)
                return false
            if (subtype && this.getNext().subType !== subtype)
                return false
            return true
        },

        nextIsOpenParen() {
            return this.nextIs(TokenType.SUBEXPR, SubType.START)
        },

        nextIsTerminal() {
            if (this.nextIsNumber())
                return true
            if (this.nextIsText())
                return true
            if (this.nextIsLogical())
                return true
            if (this.nextIsRange())
                return true
            return false
        },

        nextIsFunctionCall() {
            return this.nextIs(TokenType.FUNCTION, SubType.START)
        },

        nextIsFunctionArgumentSeparator() {
            return this.nextIs(TokenType.ARGUMENT)
        },

        nextIsEndOfFunctionCall() {
            return this.nextIs(TokenType.FUNCTION, SubType.STOP)
        },

        nextIsBinaryOperator() {
            return this.nextIs(TokenType.OP_IN)
        },

        nextIsPrefixOperator() {
            return this.nextIs(TokenType.OP_PRE)
        },

        nextIsPostfixOperator() {
            return this.nextIs(TokenType.OP_POST)
        },

        nextIsRange() {
            return this.nextIs(TokenType.OPERAND, SubType.RANGE)
        },

        nextIsNumber() {
            return this.nextIs(TokenType.OPERAND, SubType.NUMBER)
        },

        nextIsText() {
            return this.nextIs(TokenType.OPERAND, SubType.TEXT)
        },

        nextIsLogical() {
            return this.nextIs(TokenType.OPERAND, SubType.LOGICAL)
        },

        pos() {
            return index
        },
    }
}
