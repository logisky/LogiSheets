import {Builder} from '@logi-base/src/ts/common/builder'
export type ContextMenuType = 'text' | 'divider'
export interface ContextMenuItem {
    readonly type: ContextMenuType
    readonly text: string
    // tslint:disable-next-line: readonly-keyword
    click: () => void
}

class ContextMenuItemImpl implements ContextMenuItem {
    public type: ContextMenuType = 'text'
    public text = ''
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public click: () => void = () => {}
}

export class ContextMenuItemBuilder extends Builder<ContextMenuItem, ContextMenuItemImpl> {
    public constructor(obj?: Readonly<ContextMenuItem>) {
        const impl = new ContextMenuItemImpl()
        if (obj)
            ContextMenuItemBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public type(type: ContextMenuType): this {
        this.getImpl().type = type
        return this
    }

    public text(text: string): this {
        this.getImpl().text = text
        return this
    }

    public click(click: () => void): this {
        this.getImpl().click = click
        return this
    }

    protected get daa(): readonly string[] {
        return ContextMenuItemBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'type',
    ]
}

export function isContextMenuItem(value: unknown): value is ContextMenuItem {
    return value instanceof ContextMenuItemImpl
}

export function assertIsContextMenuItem(
    value: unknown
): asserts value is ContextMenuItem {
    if (!(value instanceof ContextMenuItemImpl))
        throw Error('Not a ContextMenuItem!')
}
