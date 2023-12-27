// DO NOT EDIT. CODE GENERATED BY gents.
import {PayloadsAction} from './payloads_action'
import {RecalcCell} from './recalc_cell'

// `EditAction` represents your update behavior to the workbook.
export type EditAction =
    | 'undo'
    | 'redo'
    | {payloads: PayloadsAction}
    | {recalc: readonly RecalcCell[]}
