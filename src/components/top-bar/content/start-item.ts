import {ItemType} from './start-item-type'
export interface StartItem {
    readonly type: ItemType
    readonly value: any
    readonly name: string
    readonly opened: boolean
    setOpened(opened: boolean): void
}
