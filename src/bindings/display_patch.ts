// DO NOT EDIT. CODE GENERATED BY gents.
import {SheetValues} from './sheet_values'
import {SheetColInfo} from './sheet_col_info'
import {SheetMergeCells} from './sheet_merge_cells'
import {SheetNames} from './sheet_names'
import {SheetComments} from './sheet_comments'
import {SheetStyles} from './sheet_styles'
import {SheetRowInfo} from './sheet_row_info'
import {SheetBlocks} from './sheet_blocks'

export type DisplayPatch =
    | {values: SheetValues}
    | {styles: SheetStyles}
    | {rowInfo: SheetRowInfo}
    | {colInfo: SheetColInfo}
    | {mergeCells: SheetMergeCells}
    | {comments: SheetComments}
    | {blocks: SheetBlocks}
    | {sheetNames: SheetNames}
