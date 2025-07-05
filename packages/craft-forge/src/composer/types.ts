import {Appendix, CellValue, Style} from 'logisheets-web'
import {DiyButtonConfig, DiyCellButtonType} from '../button'

/**
 * Represents a comprehensive blueprint for a craft, capturing its structure, visual characteristics,
 * and operational logic. This descriptor enables others to faithfully reconstruct or reproduce the
 * original craft by providing all necessary details about its design and functionality.
 */
export interface CraftDescriptor {
    dataArea: DataArea
    buttons: readonly Button[]
    buttonConfigs: readonly DiyButtonConfig[]

    wb?: WorkbookPart
}

export interface WorkbookPart {
    cells: readonly Cell[]
    rowCount: number
    colCount: number
}

export interface DataArea {
    direction: 'horizontal' | 'vertical'

    startRow: number
    startCol: number
    // Optional end row and column, if not specified,
    // the data area extends to the end of the craft
    endRow?: number
    endCol?: number
}

export interface Cell {
    row: number
    col: number
    formula?: string
    value?: CellValue
    style?: Style
    appendix?: Appendix
}

export interface Button {
    row: number
    col: number
    type: DiyCellButtonType
}
