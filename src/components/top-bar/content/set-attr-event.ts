import {ItemType} from './start-item-type'
export interface SetAttrEvent {
    readonly type: ItemType
    readonly set: boolean
}
