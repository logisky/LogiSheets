// https://github.com/joshbtn/excelFormulaUtilitiesJS/blob/main/src/ExcelFormulaUtilities.js

import {
    ERRORS,
    OPERATORS,
    DOUBLE_OPERATORS,
    SN_REG,
} from './const'
import { exist, matchQuote } from './utils'

export const enum TokenType {
	// '{'
	ARRAY_FUNCTION_START = 'array-function-start',
	// '}'
	ARRAY_FUNCTION_END = 'array-function-end',
	// '='
	FUNCTION_START_FLAG = 'function-start-flag',
	NOOP = 'noop',
	OPERAND = 'operand',
	FUNCTION = 'function',
	SUBEXPR = 'subexpression',
	ARGUMENT = 'argument',
	OP_PRE = 'operator-prefix',
	OP_IN = 'operator-infix',
	OP_POST = 'operator-postfix',
	WHITE_SPACE = 'white-space',
	COMMA = 'comma',
	BRACKETS = 'brackets',
	QUOTES = 'quotes',
	SEMICOLON = 'semicolon',
	UNKNOWN = 'unknown',
}
export const enum SubType {
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
	SEPARATOR = 'separator',
}
const isEu = false
class TokenStack {
    items: Token[] = []
    stackToken = ''
    push(token: Token) {
        this.items.push(token)
    }
    pop() {
        const token = this.items.pop()
        if (!token)
            return
        return new Token(token.value, token?.type ?? TokenType.UNKNOWN, SubType.STOP)
    }

    token() {
        return ((this.items.length > 0) ? this.items[this.items.length - 1] : null)
    }
    value() {
        return this.token()?.value ?? ''
    }
    type() {
        return this.token()?.type
    }
    subtype() {
        return this.token()?.subtype
    }
}
export class Token {
    constructor(
		public value: string,
		public type: TokenType,
		public subtype?: SubType,
    ) { }
    equal(token?: Token) {
        if (!token)
            return
        return token.value === this.value
			&& token.type === this.type
			&& token.subtype === this.subtype
    }
}
class Tokens {
    items: Token[] = []
    startItems: Token[] = []
    endItems: Token[] = []
    index = -1

    add(value: string, type: TokenType, subtype?: SubType) {
        const token = new Token(value, type, subtype)
        this.addRef(token)
        return token
    }
    addRef(token?: Token) {
        if (token === undefined)
            return
        this.items.push(token)
    }

    reset() {
        this.index = -1
    }
    BOF() {
        return (this.index <= 0)
    }
    EOF() {
        return (this.index >= (this.items.length - 1))
    }
    moveNext() {
        if (this.EOF()) {
            return false
        }
        this.index += 1
        return true
    }
    current() {
        if (this.index === -1) {
            return null
        }
        return (this.items[this.index])
    }
    next() {
        if (this.EOF()) {
            return null
        }
        return (this.items[this.index + 1])
    }
    previous() {
        if (this.index < 1) {
            return null
        }
        return (this.items[this.index - 1])
    }
}

export interface Config {
	readonly excludeWhiteSpace: boolean
	readonly excludeNoops: boolean
	readonly excludeBrackets: boolean
	readonly excludeParamSeparator: boolean
	readonly excludeQuotes: boolean
}
const DEFAULT_CONFIG: Config = {
    excludeNoops: false,
    excludeWhiteSpace: false,
    excludeBrackets: false,
    excludeParamSeparator: false,
    excludeQuotes: false,
}
export const getTokens = (formula: string, config = DEFAULT_CONFIG) => {

    const tokens = new Tokens()
    const tokenStack = new TokenStack()

    let offset = 0

    let token = ''

    let inString = false
    let inPath = false
    let inRange = false
    let inError = false

    const currentChar = () => formula.substr(offset, 1)
    const doubleChar = () => formula.substr(offset, 2)
    const nextChar = () => formula.substr(offset + 1, 1)
    const EOF = () => (offset >= formula.length)


    // trim left whitespaces and '=',if formula is array, trim start '{' and end '}'
    while (formula.length > 0) {
        if (formula[0] === ' ') {
            tokens.startItems.push(new Token(formula.substr(1), TokenType.WHITE_SPACE, SubType.START))
            formula = formula.substr(1)
        } else if (formula[0] === '=') {
            tokens.startItems.push(new Token(formula[0], TokenType.FUNCTION_START_FLAG))
            formula = formula.substr(1)
            break
        } else
            break
    }



    while (!EOF()) {
        // state-dependent character evaluation (order is important)
        // double-quoted strings
        // embeds are doubled
        // end marks token
        if (inString) {
            if (currentChar() === '"') {
                if (nextChar() === '"') {
                    token += '"'
                    offset += 1
                } else {
                    inString = false
                    tokens.add(token, TokenType.OPERAND, SubType.TEXT)
                    tokens.add(currentChar(), TokenType.OPERAND, SubType.TEXT)
                    token = ''
                }
            } else {
                token += currentChar()
            }
            offset += 1
            continue
        }

        // single-quoted strings (links)
        // embeds are double
        // end does not mark a token
        if (inPath) {
            if (currentChar() === '\'') {

                if (nextChar() === '\'') {
                    token += '\''
                    offset += 1
                } else {
                    inPath = false
                    token += '\''
                }
            } else {
                token += currentChar()
            }

            offset += 1
            continue
        }

        // bracketed strings (range offset or linked workbook name)
        // no embeds (changed to "()" by Excel)
        // end does not mark a token
        if (inRange) {
            if (currentChar() === ']') {
                inRange = false
            }
            token += currentChar()
            offset += 1
            continue
        }

        // error values
        // end marks a token, determined from absolute list of values
        if (inError) {
            token += currentChar()
            offset += 1
            if (exist(ERRORS, token)) {
                inError = false
                tokens.add(token, TokenType.OPERAND, SubType.ERROR)
                token = ''
            }
            continue
        }

        // scientific notation check
        if (('+-').indexOf(currentChar()) !== -1) {
            if (token.length > 1) {
                if (token.match(SN_REG)) {
                    token += currentChar()
                    offset += 1
                    continue
                }
            }
        }

        // independent character evaluation (order not important)
        // establish state-dependent character evaluations
        if (currentChar() === '"') {
            if (token.length > 0) {
                // not expected
                tokens.add(token, TokenType.UNKNOWN)
                token = ''
            }
            inString = true
            offset += 1
            continue
        }

        if (currentChar() === '\'') {
            if (token.length > 0) {
                // not expected
                tokens.add(token, TokenType.UNKNOWN)
                token = ''
            }
            token = '\''
            inPath = true
            offset += 1
            continue
        }

        if (currentChar() === '[') {
            inRange = true
            token += currentChar()
            offset += 1
            continue
        }

        if (currentChar() === '#') {
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
        if (currentChar() === '{') {
            if (token.length > 0) {
                // not expected
                tokens.add(token, TokenType.UNKNOWN)
                token = ''
            }
            tokenStack.push(tokens.add(currentChar(), TokenType.FUNCTION, SubType.START))
            // tokenStack.push(tokens.add(ARRAY_VALUE, TokenType.FUNCTION, SubType.START));
            // tokenStack.push(tokens.add("ARRAYROW", TokenType.FUNCTION, SubType.START));
            offset += 1
            continue
        }

        if (currentChar() === ';') {
            if (isEu) {
                // If is EU then handle ; as list separators
                if (token.length > 0) {
                    tokens.add(token, TokenType.OPERAND)
                    token = ''
                }
                if (tokenStack.type() !== TokenType.FUNCTION) {
                    tokens.add(currentChar(), TokenType.OP_IN, SubType.UNION)
                } else {
                    tokens.add(currentChar(), TokenType.ARGUMENT)
                }
                offset += 1
                continue
            } else {
                // Else if not Eu handle ; as array row separator
                if (token.length > 0) {
                    tokens.add(token, TokenType.OPERAND)
                    token = ''
                }
                // tokens.addRef(tokenStack.pop());
                // tokens.add(",", TokenType.ARGUMENT);
                // tokenStack.push(tokens.add("ARRAYROW", TokenType.FUNCTION, SubType.START));
                tokens.add(currentChar(), TokenType.SEMICOLON)
                offset += 1
                continue
            }
        }

        if (currentChar() === '}') {
            const currValue = tokenStack.value()
            const match = matchQuote(currentChar(), currValue)
            if (match) {
                tokenStack.pop()
                tokens.add(currentChar(), TokenType.FUNCTION, SubType.STOP)
                if (token.length > 0) {
                    tokens.add(token, TokenType.OPERAND)
                    token = ''
                }
            }
            // tokens.addRef(tokenStack.pop("ARRAYROWSTOP"));
            // tokens.addRef(tokenStack.pop("ARRAYSTOP"));
            offset += 1
            continue
        }

        // trim white-space
        if (currentChar() === ' ') {
            if (token.length > 0) {
                tokens.add(token, TokenType.OPERAND)
                token = ''
            }
            tokens.add(currentChar(), TokenType.WHITE_SPACE)
            offset += 1
            while ((currentChar() === ' ') && (!EOF())) {
                tokens.add(currentChar(), TokenType.WHITE_SPACE)
                offset += 1
            }
            continue
        }

        // multi-character comparators
        if (exist(DOUBLE_OPERATORS, doubleChar())) {
            if (token.length > 0) {
                tokens.add(token, TokenType.OPERAND)
                token = ''
            }
            tokens.add(doubleChar(), TokenType.OP_IN, SubType.LOGICAL)
            offset += 2
            continue
        }

        // standard infix operators
        if (OPERATORS.indexOf(currentChar()) !== -1) {
            if (token.length > 0) {
                tokens.add(token, TokenType.OPERAND)
                token = ''
            }
            tokens.add(currentChar(), TokenType.OP_IN)
            offset += 1
            continue
        }

        // standard postfix operators
        if (('%').indexOf(currentChar()) !== -1) {
            if (token.length > 0) {
                tokens.add(token, TokenType.OPERAND)
                token = ''
            }
            tokens.add(currentChar(), TokenType.OP_POST)
            offset += 1
            continue
        }

        // start subexpression or function
        if (currentChar() === '(') {
            if (token.length > 0) {
                tokens.add(token, TokenType.FUNCTION)
                if (!config.excludeQuotes)
                    tokens.add(currentChar(), TokenType.QUOTES, SubType.START)
                tokenStack.push(new Token(currentChar(), TokenType.FUNCTION, SubType.START))
                token = ''
            } else {
                tokenStack.push(tokens.add(currentChar(), TokenType.SUBEXPR, SubType.START))
            }
            offset += 1
            continue
        }

        // function, subexpression, array parameters
        if (currentChar() === ',' && !isEu) {
            if (token.length > 0) {
                tokens.add(token, TokenType.OPERAND)
                token = ''
            }
            if (tokenStack.type() === TokenType.SUBEXPR)
                tokens.add(currentChar(), TokenType.OP_IN, SubType.UNION)
            else if (tokenStack.type() === TokenType.FUNCTION)
                tokens.add(currentChar(), TokenType.COMMA, SubType.SEPARATOR)
            else
                tokens.add(currentChar(), TokenType.ARGUMENT)
            offset += 1
            continue
        }

        // stop subexpression
        if (currentChar() === ')') {
            const matched = matchQuote(tokenStack.value(), currentChar())
            if (token.length > 0) {
                const type = matched ? TokenType.OPERAND : TokenType.FUNCTION
                tokens.add(token, type)
                token = ''
            }
            let subtype: SubType | undefined = undefined
            if (matched) {
                tokenStack.pop()
                subtype = SubType.STOP
            }
            tokens.add(currentChar(), TokenType.QUOTES, subtype)
            offset += 1
            continue
        }

        // token accumulation
        token += currentChar()
        offset += 1

    }

    // dump remaining accumulation
    if (token.length > 0 || inString || inPath || inRange || inError) {
        if (inString || inPath || inRange || inError) {
            if (inString) {
                token = '"' + token
            } else if (inPath) {
                token = '\'' + token
            } else if (inRange) {
                token = '[' + token
            } else if (inError) {
                token = '#' + token
            }

            tokens.add(token, TokenType.UNKNOWN)
        } else {
            const type = tokenStack.type() ?? TokenType.FUNCTION
            tokens.add(token, type)
        }
    }

    // move all tokens to a new collection, excluding all unnecessary white-space tokens
    const tokens2 = new Tokens()

    while (tokens.moveNext()) {

        const token = tokens.current() as Token

        if (token.type === TokenType.WHITE_SPACE) {
            let doAddToken = (tokens.BOF()) || (tokens.EOF())
            const previous = tokens.previous()
            //if ((tokens.BOF()) || (tokens.EOF())) {}
            doAddToken = doAddToken && (((previous?.type === TokenType.FUNCTION) && (previous?.subtype === SubType.STOP)) || ((previous?.type === TokenType.SUBEXPR) && (previous?.subtype === SubType.STOP)) || (previous?.type === TokenType.OPERAND))
            //else if (!(
            //       ((tokens.previous().type === TokenType.FUNCTION) && (tokens.previous().subtype == SubType.STOP))
            //    || ((tokens.previous().type == TokenType.SUBEXPR) && (tokens.previous().subtype == SubType.STOP))
            //    || (tokens.previous().type == TokenType.OPERAND)))
            //  {}
            const next = tokens.next()
            doAddToken = doAddToken && (((next?.type === TokenType.FUNCTION) && (next?.subtype === SubType.START)) || ((next?.type === TokenType.SUBEXPR) && (next?.subtype === SubType.START)) || (next?.type === TokenType.OPERAND))
            //else if (!(
            //	((tokens.next().type == TokenType.FUNCTION) && (tokens.next().subtype == SubType.START))
            //	|| ((tokens.next().type == TokenType.SUBEXPR) && (tokens.next().subtype == SubType.START))
            //	|| (tokens.next().type == TokenType.OPERAND)))
            //	{}
            //else { tokens2.add(token.value, TokenType.OP_IN, SubType.INTERSECT)};
            if (doAddToken) {
                tokens2.add(token.value, TokenType.OP_IN, SubType.INTERSECT)
            } else if (!config.excludeWhiteSpace)
                tokens2.addRef(token)
            continue
        }

        tokens2.addRef(token)

    }

    // switch infix "-" operator to prefix when appropriate, switch infix "+" operator to noop when appropriate, identify operand
    // and infix-operator subtypes, pull "@" from in front of function names
    while (tokens2.moveNext()) {

        const token = tokens2.current() as Token
        const previous = tokens2.previous()

        if ((token.type === TokenType.OP_IN) && (token.value === '-')) {
            if (tokens2.BOF()) {
                token.type = TokenType.OP_PRE
            } else if (((previous?.type === TokenType.FUNCTION) && (previous?.subtype === SubType.STOP)) || ((previous?.type === TokenType.SUBEXPR) && (previous?.subtype === SubType.STOP)) || (previous?.type === TokenType.OP_POST) || (previous?.type === TokenType.OPERAND)) {
                token.subtype = SubType.MATH
            } else {
                token.type = TokenType.OP_PRE
            }
            continue
        }

        if ((token.type === TokenType.OP_IN) && (token.value === '+')) {
            if (tokens2.BOF()) {
                token.type = TokenType.NOOP
            } else if (((previous?.type === TokenType.FUNCTION) && (previous?.subtype === SubType.STOP)) || ((previous?.type === TokenType.SUBEXPR) && (previous?.subtype === SubType.STOP)) || (previous?.type === TokenType.OP_POST) || (previous?.type === TokenType.OPERAND)) {
                token.subtype = SubType.MATH
            } else {
                token.type = TokenType.NOOP
            }
            continue
        }

        if ((token.type === TokenType.OP_IN) && token.subtype === undefined) {
            if (('<>=').indexOf(token.value.substr(0, 1)) !== -1) {
                token.subtype = SubType.LOGICAL
            } else if (token.value === '&') {
                token.subtype = SubType.CONCAT
            } else {
                token.subtype = SubType.MATH
            }
            continue
        }

        if ((token.type === TokenType.OPERAND) && token.subtype === undefined) {
            if (isNaN(parseFloat(token.value))) {
                if ((token.value === 'TRUE') || (token.value === 'FALSE')) {
                    token.subtype = SubType.LOGICAL
                } else {
                    token.subtype = SubType.RANGE
                }
            } else {
                token.subtype = SubType.NUMBER
            }

            continue
        }

        if (token.type === TokenType.FUNCTION) {
            if (token.value.substr(0, 1) === '@') {
                token.value = token.value.substr(1)
            }
            continue
        }

    }

    tokens2.reset()
    // move all tokens to a new collection, excluding all no-ops
    const tokens3 = new Tokens()

    while (tokens2.moveNext()) {
        const current = tokens2.current()
        if (!current)
            continue
        if (current.type !== TokenType.NOOP) {
            tokens3.addRef(current)
        } else if (!config.excludeNoops)
            tokens3.addRef(current)
    }

    tokens3.reset()

    return [...tokens.startItems, ...tokens3.items, ...tokens.endItems]
}
