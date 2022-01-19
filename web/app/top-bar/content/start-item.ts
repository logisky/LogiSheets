/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {Builder} from '@logi-base/src/ts/common/builder'
import {ItemType} from './start-item-type'
export interface StartItem {
    readonly type: ItemType
    readonly value: any
    readonly name: string
    readonly opened: boolean
    setOpened(opened: boolean): void
}

class StartItemImpl implements StartItem {
    public type = ItemType.UNSPECIFIED
    public value = ''
    public name = ''
    public opened = false
    setOpened(opened: boolean): void {
        this.opened = opened
    }
}

export class StartItemBuilder extends Builder<StartItem, StartItemImpl> {
    public constructor(obj?: Readonly<StartItem>) {
        const impl = new StartItemImpl()
        if (obj)
            StartItemBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public type(type: ItemType): this {
        this.getImpl().type = type
        return this
    }

    public value(value: any): this {
        this.getImpl().value = value
        return this
    }

    public name(name: string): this {
        this.getImpl().name = name
        return this
    }

    protected get daa(): readonly string[] {
        return StartItemBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'type',
        'value',
        'name',
    ]
}

export function isStartItem(value: unknown): value is StartItem {
    return value instanceof StartItemImpl
}

export function assertIsStartItem(value: unknown): asserts value is StartItem {
    if (!(value instanceof StartItemImpl))
        throw Error('Not a StartItem!')
}
