/**
 * RenderCell - represents a cell with position and coordinate information for rendering.
 */

import type {CellInfo} from 'logisheets-web'
import {Range, StandardCell, StandardStyle, StandardValue} from './standable'

export class RenderCell {
    get width(): number {
        return this.position.width
    }

    get height(): number {
        return this.position.height
    }

    setCoordinate(coordinate: Range): this {
        this.coordinate = coordinate
        return this
    }

    setPosition(position: Range): this {
        this.position = position
        return this
    }

    setInfo(
        info: CellInfo,
        getStandardCell: () => StandardCell,
        getStandardValue: () => StandardValue,
        getStandardStyle: () => StandardStyle
    ): this {
        const c = getStandardCell()
        // Conditional formatting arrives already merged onto the cell's own style
        // by the engine (dxfs applied in priority order, colour scale interpolated
        // into the fill), so preferring it here makes fill / font / border / number
        // format all follow the rules with no further work in the painter.
        const effectiveStyle = info.conditionalFormat?.style ?? info.style
        if (effectiveStyle) {
            const style = getStandardStyle()
            style.from(effectiveStyle)
            c.setStyle(style)
        }
        // Data bars and icons are drawn on top of the cell, so they stay separate.
        c.dataBar = info.conditionalFormat?.dataBar
        c.icon = info.conditionalFormat?.icon
        if (info.value) {
            const value = getStandardValue()
            value.from(info.value)
            c.value = value
        }
        if (info.formula !== undefined) c.formula = info.formula
        if (info.diyCellId !== undefined) c.diyCellId = info.diyCellId
        if (info.blockId !== undefined) c.blockId = info.blockId
        this.info = c
        return this
    }

    setStandardCell(info?: StandardCell): this {
        this.info = info
        return this
    }

    setSkipRender(skip: boolean): this {
        this.skipRender = skip
        return this
    }

    reset(): void {
        this.hidden = false
        this.coordinate.reset()
        this.position.reset()
        this.info = undefined
    }

    public hidden = false
    /** start/end row/col index */
    public coordinate = new Range()
    /** start/end row/col pixel distance (position in the whole sheet) */
    public position = new Range()
    public info?: StandardCell
    public skipRender = false

    cover(cell: RenderCell): boolean {
        return this.coordinate.cover(cell.coordinate)
    }

    equals(cell: RenderCell): boolean {
        return cell.position.equals(this.position)
    }
}
