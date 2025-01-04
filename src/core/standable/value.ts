import {Value} from 'logisheets-web'
import {hasOwnProperty} from '@/core'
export class StandardValue {
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
    from(value: Value) {
        if (hasOwnProperty(value, 'str'))
            this.cellValueOneof = {$case: 'str', str: value.str as string}
        else if (hasOwnProperty(value, 'bool'))
            this.cellValueOneof = {$case: 'bool', bool: value.bool as boolean}
        else if (hasOwnProperty(value, 'number'))
            this.cellValueOneof = {
                $case: 'number',
                number: value.number as number,
            }
        else if (hasOwnProperty(value, 'error'))
            this.cellValueOneof = {$case: 'error', error: value.error as string}
        return this
    }
}
