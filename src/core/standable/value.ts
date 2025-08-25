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
        if (value === 'empty') {
            this.cellValueOneof = undefined
            return this
        }
        if (value.type === 'str')
            this.cellValueOneof = {$case: 'str', str: value.value as string}
        else if (value.type === 'bool')
            this.cellValueOneof = {$case: 'bool', bool: value.value as boolean}
        else if (value.type === 'number')
            this.cellValueOneof = {
                $case: 'number',
                number: value.value as number,
            }
        else if (value.type === 'error')
            this.cellValueOneof = {$case: 'error', error: value.value as string}
        return this
    }
}
