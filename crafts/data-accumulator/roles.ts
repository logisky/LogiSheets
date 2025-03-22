import {Role} from '../base/craft'

export interface DataRole extends Role {}

export class DataCollector implements DataRole {
    id: string = 'data-collector'

    init(userId: string): void {
        throw new Error('Method not implemented.')
    }
}

export class DataProvider implements DataRole {
    id: string = 'data-provider'

    init(userId: string): void {
        throw new Error('Method not implemented.')
    }
}
