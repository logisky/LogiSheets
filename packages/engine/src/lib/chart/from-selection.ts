/**
 * Turns a selected cell range into the data references a new chart needs.
 *
 * This is the "insert chart" heuristic, and it mirrors what Excel infers: a
 * leading column of text becomes the category labels, a leading row of text
 * becomes the series names, and every remaining column is one series. A bubble
 * chart reads differently — its first data column is the shared X and the rest
 * pair up as (Y, size).
 *
 * It is kept out of the spreadsheet component, and reads cells through
 * {@link SelectionCells} rather than the data service, so the inference can be
 * exercised without a workbook.
 */
import {quoteSheetName, toA1notation} from '../components/utils'

/** The cell lookups the inference needs. */
export interface SelectionCells {
    /** Whether this cell holds non-empty text (as opposed to a number). */
    isText(row: number, col: number): Promise<boolean>
    /** The cell's display text, or undefined when it is empty. */
    textAt(row: number, col: number): Promise<string | undefined>
}

export interface SelectionRange {
    startRow: number
    startCol: number
    endRow: number
    endCol: number
}

/** One series of the chart to create. */
export interface SelectedSeries {
    name: string | undefined
    valueRef: string
    /** Bubble sizes; only a bubble chart produces these. */
    sizeRef?: string
}

export interface ChartDataRefs {
    categoriesRef: string | undefined
    series: SelectedSeries[]
}

/**
 * How many cells of a row/column to sample when deciding whether it holds
 * labels. Excel looks at the whole edge; a handful is enough in practice and
 * keeps the probe cheap on a wide selection.
 */
const PROBE_LIMIT = 5

/** True when any of the first few coordinates holds text. */
async function anyText(
    cells: SelectionCells,
    coords: Array<[number, number]>
): Promise<boolean> {
    for (const [r, c] of coords.slice(0, PROBE_LIMIT)) {
        // A blank cell says nothing either way; a text cell does.
        if (await cells.isText(r, c)) return true
    }
    return false
}

export async function chartDataRefsFromSelection(
    chartType: string,
    range: SelectionRange,
    sheetName: string,
    cells: SelectionCells
): Promise<ChartDataRefs> {
    const startRow = Math.min(range.startRow, range.endRow)
    const endRow = Math.max(range.startRow, range.endRow)
    const startCol = Math.min(range.startCol, range.endCol)
    const endCol = Math.max(range.startCol, range.endCol)
    const qs = quoteSheetName(sheetName)

    // A single row or column has nothing to spare for labels.
    //
    // The label column is decided first, and from the rows *below* the corner
    // cell: the corner belongs to neither edge, and letting it vote made a
    // table with row labels but no header row (`North 1 2` / `South 3 4`) read
    // its first data row as series names. When the selection is a single row
    // there is nothing below the corner, so the corner itself decides.
    const labelProbe: Array<[number, number]> =
        endRow > startRow
            ? Array.from({length: endRow - startRow}, (_, i) => [
                  startRow + 1 + i,
                  startCol,
              ])
            : [[startRow, startCol]]
    const labelCol = endCol > startCol && (await anyText(cells, labelProbe))

    // A bubble chart's X is its first data column, numeric or not — so the
    // generic label-column rule does not apply to it.
    const xIsFirstColumn = chartType === 'bubble' && endCol > startCol
    const dataStartCol = labelCol && !xIsFirstColumn ? startCol + 1 : startCol

    // The header row is then decided from the data columns only, for the same
    // reason: the label column's own heading says nothing about the rest.
    const headerRow =
        endRow > startRow &&
        (await anyText(
            cells,
            Array.from({length: endCol - dataStartCol + 1}, (_, i) => [
                startRow,
                dataStartCol + i,
            ])
        ))

    const dataStartRow = headerRow ? startRow + 1 : startRow
    const catCol = toA1notation(
        labelCol && !xIsFirstColumn ? startCol : dataStartCol
    )
    const categoriesRef =
        labelCol || xIsFirstColumn
            ? `${qs}!$${catCol}$${dataStartRow + 1}:$${catCol}$${endRow + 1}`
            : undefined

    const colRef = (c: number) => {
        const col = toA1notation(c)
        return `${qs}!$${col}$${dataStartRow + 1}:$${col}$${endRow + 1}`
    }
    const headerOf = async (c: number) =>
        headerRow ? await cells.textAt(startRow, c) : undefined

    const series: SelectedSeries[] = []
    if (chartType === 'bubble') {
        // Three columns per bubble series: X, Y, size. The first data column is
        // the shared X, then each Y/size pair adds a series. A trailing Y with
        // no size still plots, at a default radius.
        for (let c = dataStartCol + 1; c <= endCol; c += 2) {
            series.push({
                name: await headerOf(c),
                valueRef: colRef(c),
                sizeRef: c + 1 <= endCol ? colRef(c + 1) : undefined,
            })
        }
    } else {
        for (let c = dataStartCol; c <= endCol; c++) {
            series.push({name: await headerOf(c), valueRef: colRef(c)})
        }
    }

    return {categoriesRef, series}
}
