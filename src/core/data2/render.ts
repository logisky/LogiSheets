import {getID} from '@/core/ioc/id'
import {Range, StandardCell} from '@/core/standable'
import {inject, injectable} from 'inversify'
import {WorkbookService} from './workbook'
import {TYPES} from '../ioc/types'
import {CellInfo} from '@logisheets_bg'
import {StandardValue} from '../standable/value'

@injectable()
export class RenderDataProvider {
    readonly id = getID()
    constructor(@inject(TYPES.Data) private _workbook: WorkbookService) {}

    public viewRange = new ViewRange()

    public getRenderData(
        sheetIdx: number,
        startX: number,
        startY: number,
        height: number,
        width: number
    ): RenderCell[] {
        const window = this._workbook.getDisplayWindow(
            sheetIdx,
            startX,
            startY,
            height,
            width
        )

        let y = window.startY
        const rows = window.window.rows.map((r) => {
            const renderRow = new RenderCell()
                .setCoordinate(new Range().setStartRow(r.idx).setEndRow(r.idx))
                .setPosition(
                    new Range()
                        .setStartRow(y)
                        .setEndRow(y + r.height)
                        .setEndCol(window.startX)
                )
            y += r.height
            return renderRow
        })

        let x = window.startX
        const cols = window.window.cols.map((c) => {
            const renderCol = new RenderCell()
                .setCoordinate(new Range().setStartCol(c.idx).setEndCol(c.idx))
                .setPosition(
                    new Range()
                        .setStartCol(x)
                        .setEndCol(x + c.width)
                        .setEndRow(window.startY)
                )
            x += renderCol.width
            return renderCol
        })

        const cells: RenderCell[] = []
        let idx = 0
        for (let r = 0; r < rows.length; r += 1) {
            for (let c = 0; c < cols.length; c += 1) {
                const row = rows[r]
                const col = cols[c]
                const corrdinate = new Range()
                    .setStartRow(row.coordinate.startRow)
                    .setEndRow(row.coordinate.endRow)
                    .setStartCol(col.coordinate.startCol)
                    .setEndCol(col.coordinate.endCol)

                const position = new Range()
                    .setStartRow(row.position.startRow)
                    .setEndRow(row.position.endRow)
                    .setStartCol(col.position.startCol)
                    .setEndCol(col.position.endCol)
                const renderCell = new RenderCell()
                    .setPosition(position)
                    .setCoordinate(corrdinate)
                    .setInfo(window.window.cells[idx])
                cells.push(renderCell)
                idx += 1
            }
        }

        window.window.mergeCells.forEach((m) => {
            let s: RenderCell | undefined
            for (const i in cells) {
                const cell = cells[i]
                if (
                    cell.coordinate.startRow == m.rowStart &&
                    cell.coordinate.startCol == m.colStart
                ) {
                    s = cell
                } else if (
                    cell.coordinate.endRow == m.rowEnd &&
                    cell.coordinate.endCol == m.colEnd
                ) {
                    if (s) s.setPosition(cell.position)
                    return
                } else if (
                    cell.coordinate.endRow < m.rowEnd &&
                    cell.coordinate.endCol < m.colEnd &&
                    cell.coordinate.startRow > m.rowStart &&
                    cell.coordinate.startCol > m.colStart
                ) {
                    cell.skipRender = true
                }
            }
        })
        return cells
    }
}

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

export class ViewRange {
    public fromRow = 0
    public toRow = 0
    public fromCol = 0
    public toCol = 0
    /**
     * visible rows.
     */
    public rows: readonly RenderCell[] = []
    /**
     * visible cols.
     */
    public cols: readonly RenderCell[] = []
    /**
     * visible cells
     */
    public cells: readonly RenderCell[] = []
}
