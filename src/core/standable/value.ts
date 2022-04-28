import { Value } from 'bindings'
import { hasOwnProperty } from 'common'
export class StandardValue {
    cellValueOneof?:
    | { $case: "str"; str: string }
    | { $case: "number"; number: number }
    | { $case: "bool"; bool: boolean }
    | { $case: "error"; error: string }
    get value() {
        if (this.cellValueOneof?.$case === 'str')
            return this.cellValueOneof.str
        else if (this.cellValueOneof?.$case === 'bool')
            return this.cellValueOneof.bool
        else if (this.cellValueOneof?.$case === 'error')
            return this.cellValueOneof.error
        else if (this.cellValueOneof?.$case === 'number')
            return this.cellValueOneof.number
        else
            return ''
    }
    get valueStr() {
        return this.value.toString()
    }
    static from(value: Value) {
        const v = new StandardValue()
        if (hasOwnProperty(value, 'str'))
            v.cellValueOneof = {$case: 'str', str: value.str}
        else if (hasOwnProperty(value, 'bool'))
            v.cellValueOneof = {$case: "bool", bool: value.bool}
        else if (hasOwnProperty(value, 'number'))
            v.cellValueOneof = {$case: 'number', number: value.number}
        else if (hasOwnProperty(value, 'error'))
            v.cellValueOneof = {$case: 'error', error: value.error}
        return v
    }
}