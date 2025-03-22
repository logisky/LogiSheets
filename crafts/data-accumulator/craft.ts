import {Craft} from '../base/craft'
import {DataRole} from './roles'

export class DataAccumulator implements Craft {
    id: string
    name: string
    description: string

    constructor() {
        this.id = 'data-accumulator'
        this.name = 'Data Accumulator'
        this.description = 'Data Accumulator'
    }

    editor(): HTMLElement {
        throw new Error('Method not implemented.')
    }

    loadRole(role: DataRole): void {
        this._role = role
    }

    private _role: DataRole | null = null
}

export class Field {
    name: string
    description: string
    type: string
    defaultValue: string
    required: boolean
}
