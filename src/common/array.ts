import { MAX_LEN } from './const'
export function initArr<T>(len: number, value?: T): T[] {
    return new Array(len).fill(value)
}

export function initTable<T>(initValue: T) {
    const table: T[][] = []
    for (let i = 0; i <= MAX_LEN; i += 1) {
        const row = initArr(MAX_LEN, initValue)
        table.push(row)
    }
    return table
}