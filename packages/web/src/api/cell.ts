import {CellInfo, Value, Style} from '../bindings'

export class Cell {
    public constructor(cellInfo: CellInfo) {
        this._value = CellValue.from(cellInfo.value)
        this._info = cellInfo
    }

    public getText(): string {
        return this._value.valueStr ?? ''
    }

    public getStyle(): Style {
        return this._info.style
    }

    public getFormula(): string {
        return this._info.formula
    }

    public getBlockId(): number | undefined {
        return this._info.blockId
    }

    public toCellInfo(): CellInfo {
        return this._info
    }

    private _value: CellValue
    private _info: CellInfo
}

export class CellValue {
    cellValueOneof?:
        | {$case: 'str'; str: string}
        | {$case: 'number'; number: number}
        | {$case: 'bool'; bool: boolean}
        | {$case: 'error'; error: string}
    get value() {
        if (this.cellValueOneof?.$case === 'str') return this.cellValueOneof.str
        else if (this.cellValueOneof?.$case === 'bool')
            return this.cellValueOneof.bool
        else if (this.cellValueOneof?.$case === 'error')
            return this.cellValueOneof.error
        else if (this.cellValueOneof?.$case === 'number')
            return this.cellValueOneof.number
        else return ''
    }
    get valueStr() {
        return this.value.toString()
    }
    static from(value: Value) {
        const v = new CellValue()
        if (hasOwnProperty(value, 'str'))
            v.cellValueOneof = {$case: 'str', str: value.str as string}
        else if (hasOwnProperty(value, 'bool'))
            v.cellValueOneof = {$case: 'bool', bool: value.bool as boolean}
        else if (hasOwnProperty(value, 'number'))
            v.cellValueOneof = {$case: 'number', number: value.number as number}
        else if (hasOwnProperty(value, 'error'))
            v.cellValueOneof = {$case: 'error', error: value.error as string}
        return v
    }
}

function hasOwnProperty<T, K extends PropertyKey>(
    obj: T,
    prop: K
): obj is T & Record<K, unknown> {
    return Object.prototype.hasOwnProperty.call(obj, prop)
}
