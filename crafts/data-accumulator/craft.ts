import {CraftBase} from '../base/craft'
import {DataField, DataValue} from '../base/data'
import {DataRole} from './roles'

export class DataAccumulator extends CraftBase {
    craftId: string
    name: string
    description: string

    dataFields: DataField[]
    dataValues: DataValue[]

    editor(): HTMLElement {
        throw new Error('Method not implemented.')
    }

    loadRole(role: DataRole): void {
        this._role = role
    }

    private _role: DataRole | null = null
}
