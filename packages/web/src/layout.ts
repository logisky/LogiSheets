/** A per-cell overlay (marker colour, tooltip) a craft asks the host to draw
 *  via `window.setCellLayouts`. Row and column are 0-based sheet coordinates. */
export interface CellLayout {
    readonly sheetIdx: number
    readonly row: number
    readonly col: number

    readonly background?: string
    readonly tooltip?: string
}
