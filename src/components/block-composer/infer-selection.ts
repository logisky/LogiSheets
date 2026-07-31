import {
    getSelectedCellRange,
    buildSelectedDataFromCellRange,
    isErrorMessage,
    type SelectedData,
    type DataService,
} from 'logisheets-engine'
import type {FieldSetting} from 'logisheets-core'
import {inferFields, type InferCell} from './infer'

// Guard against reading an enormous selection cell-by-cell (each is a worker
// round-trip). Excel-scale tables are far smaller; beyond this we bail.
const MAX_INFER_CELLS = 20_000

export interface InferredBlock {
    /** The region to convert — data rows only when a header row was detected. */
    selectedData: SelectedData
    convertRegion: {rowCnt: number; colCnt: number}
    /** Inferred field names/types to seed the composer. */
    initialFields: FieldSetting[]
}

/**
 * Read the selected region and infer a block schema, producing the arguments the
 * block composer needs to open in convert mode (see ./infer). Returns an
 * `{error}` when there's no range or the selection is too large to scan.
 *
 * When a header row is detected it becomes the field names and is excluded from
 * the block's records — the returned `selectedData`/`convertRegion` cover only
 * the data rows below it.
 */
export async function inferBlockFromSelection(
    dataService: DataService,
    selectedData: SelectedData
): Promise<InferredBlock | {error: string}> {
    const range = getSelectedCellRange(selectedData)
    if (!range) return {error: 'Select a range of cells first.'}

    const rowCnt = range.endRow - range.startRow + 1
    const colCnt = range.endCol - range.startCol + 1
    if (rowCnt * colCnt > MAX_INFER_CELLS) {
        return {error: 'Selection is too large to convert to a block.'}
    }

    const sheetIdx = dataService.getCurrentSheetIdx()

    // Read every cell's typed value + number format, in parallel, into a
    // row-major grid for the inference pass.
    const grid: InferCell[][] = await Promise.all(
        Array.from({length: rowCnt}, (_, r) =>
            Promise.all(
                Array.from({length: colCnt}, async (_, c) => {
                    const cell = await dataService.getCellInfo(
                        sheetIdx,
                        range.startRow + r,
                        range.startCol + c
                    )
                    if (isErrorMessage(cell)) {
                        return {value: 'empty'} as InferCell
                    }
                    const info = cell.toCellInfo()
                    return {
                        value: info.value,
                        numFmt: info.style.formatter,
                    } as InferCell
                })
            )
        )
    )

    const {fields, hasHeader} = inferFields(grid)

    // When a header row supplies the field names, the block covers only the
    // data rows below it; otherwise the whole selection is the block.
    const dataStartRow = range.startRow + (hasHeader ? 1 : 0)
    const dataRowCnt = range.endRow - dataStartRow + 1
    const dataSelectedData = buildSelectedDataFromCellRange(
        dataStartRow,
        range.startCol,
        range.endRow,
        range.endCol,
        'none'
    )

    return {
        selectedData: dataSelectedData,
        convertRegion: {rowCnt: dataRowCnt, colCnt},
        initialFields: fields,
    }
}
