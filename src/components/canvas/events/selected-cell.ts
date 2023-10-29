export interface SelectedCell {
    readonly row: number
    readonly col: number
    readonly source: 'editbar' | 'none'
}
