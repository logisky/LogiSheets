import {Builder} from '@logi-base/src/ts/common/builder'
import {StandardFont} from '@logi-sheets/web/core/standable'
export class Settings {
    readonly leftTop = new LeftTopBuilder().build()
    readonly grid = new GridBuilder().build()
    readonly fixedHeader = new FixedHeaderStyleBuilder().build()
    readonly defaultCellSize = {width: 40, height: 25}
    readonly showContextMenu = true
    readonly showToolBar = true
    readonly showSheetsTab = true
    readonly topBar = '102px'
    readonly bottomBar = '0'
    readonly defaultSheetName = 'sheet'
    readonly scrollbarSize = 16
    readonly emptyFillColor = 'white'
}

export interface Grid {
    readonly showHorizontal: boolean
    readonly showVertical: boolean
    readonly fillStyle: string
    readonly strokeStyle: string
    readonly lineWidth: number
}

class GridImpl implements Grid {
    public showHorizontal = false
    public showVertical = false
    public fillStyle = '#ffffff'
    public strokeStyle = '#000000'
    public lineWidth = 1
}

export class GridBuilder extends Builder<Grid, GridImpl> {
    public constructor(obj?: Readonly<Grid>) {
        const impl = new GridImpl()
        if (obj)
            GridBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public showHorizontal(showHorizontal: boolean): this {
        this.getImpl().showHorizontal = showHorizontal
        return this
    }

    public showVertical(showVertical: boolean): this {
        this.getImpl().showVertical = showVertical
        return this
    }

    public fillStyle(fillStyle: string): this {
        this.getImpl().fillStyle = fillStyle
        return this
    }

    public strokeStyle(strokeStyle: string): this {
        this.getImpl().strokeStyle = strokeStyle
        return this
    }

    public lineWidth(lineWidth: number): this {
        this.getImpl().lineWidth = lineWidth
        return this
    }
}

export function isGrid(value: unknown): value is Grid {
    return value instanceof GridImpl
}

export function assertIsGrid(value: unknown): asserts value is Grid {
    if (!(value instanceof GridImpl))
        throw Error('Not a Grid!')
}

export interface LeftTop {
    readonly width: number
    readonly height: number
    /**
     * Fixed header content color.
     */
    readonly strokeStyle: string
}

class LeftTopImpl implements LeftTop {
    public width = 32
    public height = 24
    public strokeStyle = '#f4f5f8'
}

export class LeftTopBuilder extends Builder<LeftTop, LeftTopImpl> {
    public constructor(obj?: Readonly<LeftTop>) {
        const impl = new LeftTopImpl()
        if (obj)
            LeftTopBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public width(width: number): this {
        this.getImpl().width = width
        return this
    }

    public height(height: number): this {
        this.getImpl().height = height
        return this
    }
}

export function isLeftTop(value: unknown): value is LeftTop {
    return value instanceof LeftTopImpl
}

export function assertIsLeftTop(value: unknown): asserts value is LeftTop {
    if (!(value instanceof LeftTopImpl))
        throw Error('Not a LeftTop!')
}

export interface FixedHeaderStyle {
    readonly font: StandardFont
}

class FixedHeaderStyleImpl implements FixedHeaderStyle {
    public font = new StandardFont()
}

export class FixedHeaderStyleBuilder extends Builder<FixedHeaderStyle, FixedHeaderStyleImpl> {
    public constructor(obj?: Readonly<FixedHeaderStyle>) {
        const impl = new FixedHeaderStyleImpl()
        if (obj)
            FixedHeaderStyleBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public font(font: StandardFont): this {
        this.getImpl().font = font
        return this
    }
}

export function isFixedHeaderStyle(value: unknown): value is FixedHeaderStyle {
    return value instanceof FixedHeaderStyleImpl
}

export function assertIsFixedHeaderStyle(
    value: unknown
): asserts value is FixedHeaderStyle {
    if (!(value instanceof FixedHeaderStyleImpl))
        throw Error('Not a FixedHeaderStyle!')
}
