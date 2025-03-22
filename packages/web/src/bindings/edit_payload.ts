// DO NOT EDIT. CODE GENERATED BY gents.
import {BlockInput} from './block_input'
import {BlockStyleUpdate} from './block_style_update'
import {CellClear} from './cell_clear'
import {CellFormatBrush} from './cell_format_brush'
import {CellInput} from './cell_input'
import {CellStyleUpdate} from './cell_style_update'
import {CreateBlock} from './create_block'
import {CreateSheet} from './create_sheet'
import {DeleteColsInBlock} from './delete_cols_in_block'
import {DeleteCols} from './delete_cols'
import {DeleteRowsInBlock} from './delete_rows_in_block'
import {DeleteRows} from './delete_rows'
import {DeleteSheet} from './delete_sheet'
import {EphemeralCellInput} from './ephemeral_cell_input'
import {EphemeralCellStyleUpdate} from './ephemeral_cell_style_update'
import {InsertColsInBlock} from './insert_cols_in_block'
import {InsertCols} from './insert_cols'
import {InsertRowsInBlock} from './insert_rows_in_block'
import {InsertRows} from './insert_rows'
import {LineFormatBrush} from './line_format_brush'
import {LineStyleUpdate} from './line_style_update'
import {MergeCells} from './merge_cells'
import {MoveBlock} from './move_block'
import {RemoveBlock} from './remove_block'
import {SetColWidth} from './set_col_width'
import {SetRowHeight} from './set_row_height'
import {SetVisible} from './set_visible'
import {SheetRename} from './sheet_rename'
import {SplitMergedCells} from './split_merged_cells'

// `EditPayload` is the basic update unit of the Workbook. Developers can config their own
// `EditAction` (e.g. setting a button to create a table) to facilitate their users.
export type EditPayload =
    | {blockInput: BlockInput}
    | {moveBlock: MoveBlock}
    | {removeBlock: RemoveBlock}
    | {createBlock: CreateBlock}
    | {cellStyleUpdate: CellStyleUpdate}
    | {ephemeralCellStyleUpdate: EphemeralCellStyleUpdate}
    | {lineStyleUpdate: LineStyleUpdate}
    | {blockStyleUpdate: BlockStyleUpdate}
    | {cellFormatBrush: CellFormatBrush}
    | {lineFormatBrush: LineFormatBrush}
    | {cellInput: CellInput}
    | {ephemeralCellInput: EphemeralCellInput}
    | {cellClear: CellClear}
    | {setColWidth: SetColWidth}
    | {setRowHeight: SetRowHeight}
    | {setVisible: SetVisible}
    | {mergeCells: MergeCells}
    | {splitMergedCells: SplitMergedCells}
    | {sheetRename: SheetRename}
    | {createSheet: CreateSheet}
    | {deleteSheet: DeleteSheet}
    | {insertCols: InsertCols}
    | {deleteCols: DeleteCols}
    | {insertRows: InsertRows}
    | {deleteRows: DeleteRows}
    | {insertColsInBlock: InsertColsInBlock}
    | {deleteColsInBlock: DeleteColsInBlock}
    | {insertRowsInBlock: InsertRowsInBlock}
    | {deleteRowsInBlock: DeleteRowsInBlock}
