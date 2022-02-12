import {Value} from 'proto/message'
export class StandardValue implements Value {
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
        v.cellValueOneof = value.cellValueOneof
        return v
    }
}