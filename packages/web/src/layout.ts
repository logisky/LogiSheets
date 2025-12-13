export interface CellLayout {
    readonly sheetIdx: number
    readonly row: number
    readonly col: number

    readonly background?: string
    readonly tooltip?: string
}
