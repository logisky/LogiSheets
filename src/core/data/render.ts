import {Range, StandardCell} from '@/core/standable'
import {CellInfo, Value} from 'logisheets-web'
import {StandardValue} from '../standable/value'
import {StandardStyle} from '../standable/style'

export class RenderCell {
    get width() {
        return this.position.width
    }

    get height() {
        return this.position.height
    }
    setCoordinate(coordinate: Range) {
        this.coordinate = coordinate
        return this
    }
    setPosition(position: Range) {
        this.position = position
        return this
    }
    setInfo(
        info: CellInfo,
        getStandardCell: () => StandardCell,
        getStandardValue: () => StandardValue,
        getStandardStyle: () => StandardStyle
    ) {
        const c = getStandardCell()
        if (info.style) {
            const style = getStandardStyle()
            style.from(info.style)
            c.setStyle(style)
        }
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

    reset() {
        this.hidden = false
        this.coordinate.reset()
        this.position.reset()
        this.info = undefined
    }

    public hidden = false
    /**
     * start/end row/col index
     */
    public coordinate = new Range()
    /**
     * start/end row/col pixel distance
     *
     * Note: this is the position in the whole sheet
     */
    public position = new Range()
    public info?: StandardCell
    public skipRender = false

    cover(cell: RenderCell) {
        return this.coordinate.cover(cell.coordinate)
    }

    equals(cell: RenderCell) {
        return cell.position.equals(this.position)
    }
}

export class RenderCellSegment {
    public constructor(
        public readonly from: number,
        public readonly to: number,
        public cells: readonly RenderCell[]
    ) {}
}
