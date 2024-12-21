import {Range, StandardCell} from '@/core/standable'
import {CellInfo} from 'logisheets-web'
import {StandardValue} from '../standable/value'
import {LeftTop} from '../settings'

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
    setInfo(info: CellInfo) {
        let c = this.info
        if (!c) c = new StandardCell()
        if (info.style) c.setStyle(info.style)
        if (info.value) c.value = StandardValue.from(info.value)
        if (info.formula !== undefined) c.formula = info.formula
        return this
    }

    public hidden = false
    /**
     * start/end row/col index
     */
    public coordinate = new Range()
    /**
     * start/end row/col pixel distance
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

export function toCanvasPosition(
    pos: Range,
    anchorX: number,
    anchorY: number,
    type?: 'row' | 'col' | 'cell'
): Range {
    let rowOffset = 0
    let colOffset = 0
    if (type == 'row') {
        rowOffset = LeftTop.height - anchorY
        colOffset = 0
    } else if (type == 'cell') {
        rowOffset = LeftTop.height - anchorY
        colOffset = LeftTop.width - anchorX
    } else {
        rowOffset = 0
        colOffset = LeftTop.width - anchorX
    }
    return new Range()
        .setStartRow(Math.max(0, pos.startRow + rowOffset))
        .setEndRow(Math.max(0, pos.endRow + rowOffset))
        .setStartCol(Math.max(0, pos.startCol + colOffset))
        .setEndCol(Math.max(0, pos.endCol + colOffset))
}
