import {ItemType} from './start-item-type'
export interface StartItem {
    readonly type: ItemType
    readonly value: unknown
    readonly name: string
    readonly opened: boolean
    setOpened(opened: boolean): void
}
