/* eslint-disable max-lines */
import {Builder} from '@logi-base/src/ts/common/builder'
interface Language {
    readonly true: string
    readonly false: string
    readonly argumentSeparator: string,
    readonly decimalSeparator: string,
    reformatNumberForJsParsing(n: string): string
    isScientificNotation(token: string): boolean
}
const EN_US: Language = {
// value for true
    true: 'TRUE',
    // value for false
    false: 'FALSE',
    // separates function arguments
    argumentSeparator: ',',
    // decimal point in numbers
    decimalSeparator: '.',
    // returns number string that can be parsed by Number()
    reformatNumberForJsParsing: (n: string) => {
        return n
    },
    isScientificNotation: (token: string) => {
        return /^[1-9]{1}(\.[0-9]+)?E{1}$/.test(token)
    },
}
const DE_DE: Language = {
    true: 'WAHR',
    false: 'FALSCH',
    argumentSeparator: ';',
    decimalSeparator: ',',
    reformatNumberForJsParsing: (n: string) => {
        return n.replace(',', '.')
    },
    isScientificNotation: (token: string) => {
        return /^[1-9]{1}(,[0-9]+)?E{1}$/.test(token)
    },
}
export const enum TokenType {
    UNSPECIFIED = 'unspecified',
    NOOP = 'noop',
    OPERAND = 'operand',
    FUNCTION = 'function',
    SUBEXPR = 'subexpression',
    ARGUMENT = 'argument',
    OP_PRE = 'operator-prefix',
    OP_IN = 'operator-infix',
    OP_POST = 'operator-postfix',
    WHITESPACE = 'white-space',
    UNKNOWN = 'unknown',
}
export const enum SubType {
    UNSPECIFIED = 'unspecified',
    START = 'start',
    STOP = 'stop',

    TEXT = 'text',
    NUMBER = 'number',
    LOGICAL = 'logical',
    ERROR = 'error',
    RANGE = 'range',

    MATH = 'math',
    CONCAT = 'concatenate',
    INTERSECT = 'intersect',
    UNION = 'union',
}

export interface Token {
    readonly value: string
    readonly type: TokenType
    readonly subType: SubType
    updateType(type: TokenType): void
    updateSubType(subType: SubType): void
    updateValue(value: string): void
}

class TokenImpl implements Token {
    public value = ''
    public type = TokenType.UNSPECIFIED
    public subType = SubType.UNSPECIFIED
    updateType(type: TokenType): void {
        this.type = type
    }

    updateSubType(subType: SubType): void {
        this.subType = subType
    }

    updateValue(value: string): void {
        this.value = value
    }
}

export class TokenBuilder extends Builder<Token, TokenImpl> {
    public constructor(obj?: Readonly<Token>) {
        const impl = new TokenImpl()
        if (obj)
            TokenBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public value(value: string): this {
        this.getImpl().value = value
        return this
    }

    public type(type: TokenType): this {
        this.getImpl().type = type
        return this
    }

    public subType(subType: SubType): this {
        this.getImpl().subType = subType
        return this
    }
}

export function isToken(value: unknown): value is Token {
    return value instanceof TokenImpl
}

export function assertIsToken(value: unknown): asserts value is Token {
    if (!(value instanceof TokenImpl))
        throw Error('Not a Token!')
}

class Tokens {
    add(value: string, type: TokenType, subType = SubType.UNSPECIFIED) {
        const token = new TokenBuilder()
            .value(value)
            .type(type)
            .subType(subType)
            .build()
        this.addRef(token)
        return token
    }

    addRef(token: Token | undefined) {
        if (token === undefined)
            return
        this._items.push(token)
    }

    reset() {
        this._index = -1
    }

    isBof() {
        return this._index <= 0
    }

    isEof() {
        return this._index >= this._items.length - 1
    }

    moveNext(): Token | undefined {
        if (this.isEof())
            return
        this._index++
        return this._items[this._index]
    }

    current() {
        if (this._index == -1)
            return
        return this._items[this._index]
    }

    next() {
        if (this.isEof())
            return
        return this._items[this._index + 1]
    }

    previous() {
        if (this._index < 1)
            return
        return (this._items[this._index - 1])
    }

    toArray() {
        return this._items
    }
    private _index = -1
    // tslint:disable-next-line: readonly-array
    private _items: Token[] = []
}

class TokenStack {
    push(token: Token) {
        this._items.push(token)
    }

    pop(): Token | undefined {
        const token = this._items.pop()
        return new TokenBuilder()
            .value('')
            .type(token?.type ?? TokenType.UNSPECIFIED)
            .subType(SubType.STOP)
            .build()
    }

    lastToken(): Token | undefined {
        return this._items[this._items.length - 1]
    }

    type() {
        return this.lastToken()?.type ?? TokenType.UNSPECIFIED
    }
    // tslint:disable-next-line: readonly-array
    private _items: Token[] = []
}

// tslint:disable-next-line: max-func-body-length
export function tokenize(
    formula: string,
    languageOpt: 'en-us' | 'be-be' = 'en-us',
): readonly Token[] {
    const language = languageOpt === 'en-us' ? EN_US : DE_DE
    let tokens = new Tokens()
    let formulaCopied = formula
    const tokenStack = new TokenStack()

    let offset = 0

    const currentChar = () => { return formulaCopied.substr(offset, 1) }
    const doubleChar = () => { return formulaCopied.substr(offset, 2) }
    const nextChar = () => { return formulaCopied.substr(offset + 1, 1) }
    const isEof = () => { return (offset >= formulaCopied.length) }
    const isPreviousNonDigitBlank = () => {
        let offsetCopy = offset
        if (offsetCopy == 0)
            return true

        while (offsetCopy > 0) {
            if (!/\d/.test(formulaCopied[offsetCopy]))
                return /\s/.test(formulaCopied[offsetCopy])

            offsetCopy -= 1
        }
        return false
    }

    const isNextNonDigitTheRangeOperator = () => {
        let offsetCopy = offset

        while (offsetCopy < formulaCopied.length) {
            if (!/\d/.test(formulaCopied[offsetCopy]))
                return /:/.test(formulaCopied[offsetCopy])

            offsetCopy += 1
        }
        return false
    }

    let token = ''

    let inString = false
    let inPath = false
    let inRange = false
    let inError = false
    let inNumeric = false

    while (formulaCopied.length > 0)
        if (formulaCopied.substr(0, 1) == ' ')
            formulaCopied = formulaCopied.substr(1)
        else {
            if (formulaCopied.substr(0, 1) == '=')
                formulaCopied = formulaCopied.substr(1)
            break
        }

    while (!isEof()) {
        // state-dependent character evaluation (order is important)

        // double-quoted strings
        // embeds are doubled
        // end marks token

        if (inString) {
            if (currentChar() == '"')
                if (nextChar() == '"') {
                    token += '"'
                    offset += 1
                } else {
                    inString = false
                    tokens.add(token, TokenType.OPERAND, SubType.TEXT)
                    token = ''
                }
            else
                token += currentChar()
            offset += 1
            continue
        }

        // single-quoted strings (links)
        // embeds are double
        // end does not mark a token

        if (inPath) {
            if (currentChar() == '\'')
                if (nextChar() == '\'') {
                    token += '\''
                    offset += 1
                } else
                    inPath = false
            else
                token += currentChar()
            offset += 1
            continue
        }

        // bracked strings (range offset or linked workbook name)
        // no embeds (changed to "()" by Excel)
        // end does not mark a token

        if (inRange) {
            if (currentChar() == ']')
                inRange = false
            token += currentChar()
            offset += 1
            continue
        }

        // error values
        // end marks a token, determined from absolute list of values

        if (inError) {
            token += currentChar()
            offset += 1
            if ((',#NULL!,#DIV/0!,#VALUE!,#REF!,#NAME?,#NUM!,#N/A,')
                .indexOf(',' + token + ',') != -1) {
                inError = false
                tokens.add(token, TokenType.OPERAND, SubType.ERROR)
                token = ''
            }
            continue
        }

        if (inNumeric) {
            if ([language.decimalSeparator, 'E'].indexOf(currentChar()) != -1
                || /\d/.test(currentChar())) {
                token += currentChar()

                offset += 1
                continue
            }
            if (('+-').indexOf(currentChar()) != -1
                && language.isScientificNotation(token)) {
                token += currentChar()

                offset += 1
                continue
            }
            inNumeric = false
            const jsValue = language.reformatNumberForJsParsing(token)
            tokens.add(jsValue, TokenType.OPERAND, SubType.NUMBER)
            token = ''
        }

        // scientific notation check

        if (('+-').indexOf(currentChar()) != -1
            && token.length > 1
            && language.isScientificNotation(token)) {
            token += currentChar()
            offset += 1
            continue
        }

        // independent character evaulation (order not important)

        // function, subexpression, array parameters

        if (currentChar() == language.argumentSeparator) {
            if (token.length > 0) {
                tokens.add(token, TokenType.OPERAND)
                token = ''
            }

            if (tokenStack.type() == TokenType.FUNCTION) {
                tokens.add(',', TokenType.ARGUMENT)

                offset += 1
                continue
            }
        }

        if (currentChar() == ',') {
            if (token.length > 0) {
                tokens.add(token, TokenType.OPERAND)
                token = ''
            }

            tokens.add(currentChar(), TokenType.OP_IN, SubType.UNION)

            offset += 1
            continue
        }

        // establish state-dependent character evaluations

        if (/\d/.test(
            currentChar()
        ) && (!token || isPreviousNonDigitBlank()) && !isNextNonDigitTheRangeOperator()) {
            inNumeric = true
            token += currentChar()
            offset += 1
            continue
        }

        if (currentChar() == '"') {
            if (token.length > 0) {
                // not expected
                tokens.add(token, TokenType.UNKNOWN)
                token = ''
            }
            inString = true
            offset += 1
            continue
        }

        if (currentChar() == '\'') {
            if (token.length > 0) {
                // not expected
                tokens.add(token, TokenType.UNKNOWN)
                token = ''
            }
            inPath = true
            offset += 1
            continue
        }

        if (currentChar() == '[') {
            inRange = true
            token += currentChar()
            offset += 1
            continue
        }

        if (currentChar() == '#') {
            if (token.length > 0) {
                // not expected
                tokens.add(token, TokenType.UNKNOWN)
                token = ''
            }
            inError = true
            token += currentChar()
            offset += 1
            continue
        }

        // mark start and end of arrays and array rows

        if (currentChar() == '{') {
            if (token.length > 0) {
                // not expected
                tokens.add(token, TokenType.UNKNOWN)
                token = ''
            }
            tokenStack
                .push(tokens.add('ARRAY', TokenType.FUNCTION, SubType.START))
            tokenStack.push(
                tokens.add('ARRAYROW', TokenType.FUNCTION, SubType.START)
            )
            offset += 1
            continue
        }

        if (currentChar() == ';') {
            if (token.length > 0) {
                tokens.add(token, TokenType.OPERAND)
                token = ''
            }
            tokens.addRef(tokenStack.pop())
            tokens.add(',', TokenType.ARGUMENT)
            tokenStack.push(
                tokens.add('ARRAYROW', TokenType.FUNCTION, SubType.START)
            )
            offset += 1
            continue
        }

        if (currentChar() == '}') {
            if (token.length > 0) {
                tokens.add(token, TokenType.OPERAND)
                token = ''
            }
            tokens.addRef(tokenStack.pop())
            tokens.addRef(tokenStack.pop())
            offset += 1
            continue
        }

        // trim white-space

        if (currentChar() == ' ') {
            if (token.length > 0) {
                tokens.add(token, TokenType.OPERAND)
                token = ''
            }
            tokens.add(currentChar(), TokenType.WHITESPACE)
            offset += 1
            while ((currentChar() == ' ') && (!isEof()))
                offset += 1
            continue
        }

        // multi-character comparators

        if ((',>=,<=,<>,').indexOf(',' + doubleChar() + ',') != -1) {
            if (token.length > 0) {
                tokens.add(token, TokenType.OPERAND)
                token = ''
            }
            tokens.add(doubleChar(), TokenType.OP_IN, SubType.LOGICAL)
            offset += 2
            continue
        }

        // standard infix operators

        if (('+-*/^&=><').indexOf(currentChar()) != -1) {
            if (token.length > 0) {
                tokens.add(token, TokenType.OPERAND)
                token = ''
            }
            tokens.add(currentChar(), TokenType.OP_IN)
            offset += 1
            continue
        }

        // standard postfix operators

        if (('%').indexOf(currentChar()) != -1) {
            if (token.length > 0) {
                tokens.add(token, TokenType.OPERAND)
                token = ''
            }
            tokens.add(currentChar(), TokenType.OP_POST)
            offset += 1
            continue
        }

        // start subexpression or function

        if (currentChar() == '(') {
            if (token.length > 0) {
                tokenStack.push(
                    tokens.add(token, TokenType.FUNCTION, SubType.START)
                )
                token = ''
            } else
                tokenStack
                    .push(tokens.add('', TokenType.SUBEXPR, SubType.START))
            offset += 1
            continue
        }

        // stop subexpression

        if (currentChar() == ')') {
            if (token.length > 0) {
                tokens.add(token, TokenType.OPERAND)
                token = ''
            }
            tokens.addRef(tokenStack.pop())
            offset += 1
            continue
        }

        // token accumulation

        token += currentChar()
        offset += 1

    }

    // dump remaining accumulation

    if (token.length > 0) tokens.add(token, TokenType.OPERAND)

    // move all tokens to a new collection, excluding all unnecessary white-space tokens

    const tokens2 = new Tokens()
    let currToken = tokens.current()

    while (currToken !== undefined) {
        if (currToken.type == TokenType.WHITESPACE) {
            if ((tokens.isBof()) || (tokens.isEof())) {
                // no-op
            } else if (!(
                ((tokens.previous()?.type == TokenType.FUNCTION) && (tokens
                    .previous()?.subType == SubType.STOP)) ||
                 ((tokens.previous()?.type == TokenType.SUBEXPR) && (tokens
                     .previous()?.subType == SubType.STOP)) ||
                 (tokens.previous()?.type == TokenType.OPERAND)
            )
            ) {
                // no-op
            }
            else if (!(
                ((tokens.next()?.type == TokenType.FUNCTION) && (tokens
                    .next()?.subType == SubType.START)) ||
                 ((tokens.next()?.type == TokenType.SUBEXPR) && (tokens
                     .next()?.subType == SubType.START)) ||
                 (tokens.next()?.type == TokenType.OPERAND)
            )
            ) {
                // no-op
            }
            else
                tokens2.add(currToken.value, TokenType.OP_IN, SubType.INTERSECT)
            currToken = tokens.next()
            continue
        }

        tokens2.addRef(currToken)
        currToken = tokens.next()

    }

    // switch infix "-" operator to prefix when appropriate, switch infix "+" operator to noop when appropriate, identify operand
    // and infix-operator subtypes, pull "@" from in front of function names
    let currToken2 = tokens2.current()

    while (currToken2 !== undefined) {
        if ((currToken2.type == TokenType.OP_IN) && (currToken2.value == '-')) {
            if (tokens2.isBof())
                currToken2.updateType(TokenType.OP_PRE)
            else if (
                ((tokens2.previous()?.type == TokenType.FUNCTION) && (tokens2
                    .previous()?.subType == SubType.STOP)) ||
               ((tokens2.previous()?.type == TokenType.SUBEXPR) && (tokens2
                   .previous()?.subType == SubType.STOP)) ||
               (tokens2.previous()?.type == TokenType.OP_POST) ||
               (tokens2.previous()?.type == TokenType.OPERAND)
            )
                currToken2.updateSubType(SubType.MATH)
            else
                currToken2.updateType(TokenType.OP_PRE)
            currToken2 = tokens2.moveNext()
            continue
        }

        if ((currToken2.type == TokenType.OP_IN) && (currToken2.value == '+')) {
            if (tokens2.isBof())
                currToken2.updateType(TokenType.NOOP)
            else if (
                ((tokens2.previous()?.type == TokenType.FUNCTION) && (tokens2
                    .previous()?.subType == SubType.STOP)) ||
               ((tokens2.previous()?.type == TokenType.SUBEXPR) && (tokens2
                   .previous()?.subType == SubType.STOP)) ||
               (tokens2.previous()?.type == TokenType.OP_POST) ||
               (tokens2.previous()?.type == TokenType.OPERAND)
            )
                currToken2.updateSubType(SubType.MATH)
            else
                currToken2.updateType(TokenType.NOOP)
            currToken2 = tokens2.moveNext()
            continue
        }

        if ((currToken2.type == TokenType.OP_IN) && (currToken2.subType.length == 0)) {
            if (('<>=').indexOf(currToken2.value.substr(0, 1)) != -1)
                currToken2.updateSubType(SubType.LOGICAL)
            else if (currToken2.value == '&')
                currToken2.updateSubType(SubType.CONCAT)
            else
                currToken2.updateSubType(SubType.MATH)
            currToken2 = tokens2.moveNext()
            continue
        }

        if ((currToken2.type == TokenType.OPERAND) && (currToken2.subType.length == 0)) {
            if (isNaN(Number(language
                .reformatNumberForJsParsing(currToken2.value))))
                if (currToken2.value == language.true) {
                    currToken2.updateSubType(SubType.LOGICAL)
                    currToken2.updateValue('TRUE')
                } else if (currToken2.value == language.false) {
                    currToken2.updateSubType(SubType.LOGICAL)
                    currToken2.updateValue('FALSE')
                } else
                    currToken2.updateSubType(SubType.RANGE)
            else {
                currToken2.updateSubType(SubType.NUMBER)
                currToken2.updateValue(language
                    .reformatNumberForJsParsing(currToken2.value))
            }
            currToken2 = tokens2.moveNext()
            continue
        }

        if (currToken2.type == TokenType.FUNCTION) {
            if (currToken2.value.substr(0, 1) == '@')
                currToken2.updateValue(currToken2.value.substr(1))
            currToken2 = tokens2.moveNext()
            continue
        }
        currToken2 = tokens2.moveNext()
    }

    tokens2.reset()

    // move all tokens to a new collection, excluding all noops

    tokens = new Tokens()

    while (tokens2.moveNext())
        if (tokens2.current()?.type != TokenType.NOOP)
            tokens.addRef(tokens2.current())

    tokens.reset()

    return tokens.toArray()
}
