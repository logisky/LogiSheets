import {SPLITTER} from './const'
export function matchQuote(quote1: string, quote2: string) {
    const quotes = new Map([
        ['(', ')'],
        [')', '('],
        ['[', ']'],
        [']', '['],
        ['{', '}'],
        ['}', '{'],
    ])
    return (quotes.get(quote1) ?? '') === quote2
}

export function exist(arr: string[], char: string) {
    const joinBySplitter = (arr: string[]) => [SPLITTER].concat(arr, SPLITTER)
    return joinBySplitter(arr).indexOf(SPLITTER + char + SPLITTER) !== -1
}
