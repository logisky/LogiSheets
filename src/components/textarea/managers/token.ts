import { getTokens, SubType, Token, TokenType } from '@/core/formula'
// EXPORT ONLY FOR TEST
export class TokenManager {
    getToken(i: number): Token | undefined {
        if (i === -1)
            return
        return this._tokens[i]
    }
    getTokenIndex(token?: Token) {
        return this._tokens.findIndex(t => t === token)
    }
    isFunctionStart(token: Token) {
        if (token.type === TokenType.FUNCTION)
            return true
        if (token.type === TokenType.OPERAND && token.subtype === SubType.RANGE)
            return true
        return false
    }
    isOperandStart(token: Token) {
        if (token.type === TokenType.OPERAND)
            return true
        if (token.subtype === SubType.SEPARATOR)
            return true
        if (token.subtype === SubType.START)
            return true
        return false
    }
    getFnInfo(token: Token | number = -1) {
        let tokenIndex = -1
        let paramCount = 0
        let fnIndex = -1
        if (typeof token === 'object')
            tokenIndex = this.getTokenIndex(token)
        else
            tokenIndex = token
        if (tokenIndex === -1)
            return { fnIndex, paramCount }
        let stopCount = 1
        for (let i = tokenIndex; i >= 0; i--) {
            const t = this._tokens[i]
            if (t.type === TokenType.FUNCTION && stopCount <= 0) {
                fnIndex = i
                break
            }
            if (t.subtype === SubType.STOP) {
                stopCount++
                continue
            }
            if (t.subtype === SubType.START) {
                stopCount--
                continue
            }
            if (t.type === TokenType.OPERAND || t.type === TokenType.FUNCTION)
                paramCount++
        }
        return { fnIndex, paramCount }
    }

    getTokens(text: string) {
        if (text === this._text)
            return this._tokens
        this._tokens = getTokens(text)
        return this._tokens
    }
    getTokenIndexByCursor(cursor: number, text: string) {
        const tokens = this.getTokens(text)
        if (tokens.length === 0 || cursor === 0)
            return -1
        let currCursor = 0
        let result = -1
        for (let i = 0; i < tokens.length; i++) {
            const curr = tokens[i]
            const start = currCursor
            const end = currCursor + curr.value.length
            if (cursor > start && cursor <= end) {
                result = i
                break
            }
            currCursor = end
        }
        if (currCursor === cursor) {
            result = tokens.length - 1
        }
        // 往前找不是空格的token
        for (let i = result; i >= 0; i--) {
            const t = tokens[i]
            if (t.type !== TokenType.WHITE_SPACE)
                break
            result = i
        }
        return result
    }
    getLastTokenWithType(currIndex: number, type: TokenType, subtype?: SubType) {
        let result = -1
        for (let i = currIndex; i >= 0; i--) {
            const t = this._tokens[i]
            if (t.type !== type)
                continue
            if (subtype !== undefined && t.subtype !== subtype)
                continue
            result = i
        }
        return result
    }
    getNextTokenWithType(currIndex: number, type: TokenType, subtype?: SubType) {
        let result = -1
        for (let i = currIndex; i < this._tokens.length; i++) {
            const t = this._tokens[i]
            if (t.type !== type)
                continue
            if (subtype !== undefined && t.subtype !== subtype)
                continue
            result = i
        }
        return result
    }
    filterTokens(type: TokenType, start: number, end = this._tokens.length - 1) {
        const result: Token[] = []
        for (let i = start; i <= end; i++) {
            const t = this._tokens[i]
            if (t.type === type)
                result.push(t)
        }
        return result
    }
    getTokenPosition(token: Token) {
        const tokenIndex = this.getTokenIndex(token)
        if (tokenIndex === -1)
            return
        const start = this._tokens.slice(0, tokenIndex).reduce((a, b) => a + b.value.length, 0)
        const count = token.value.length
        return { start, count }
    }
    private _text = ''
    private _tokens: readonly Token[] = []
}
