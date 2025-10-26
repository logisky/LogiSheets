import {EditPayload} from '../bindings'
import {SetBlockLineNameField} from './set_block_line_name_field'
import {SetBlockLineNumFmt} from './set_block_line_num_fmt'
import {SetCellAlignment} from './set_cell_alignment'
import {SetCellBorder} from './set_cell_border'
import {SetCellFont} from './set_cell_font'
import {SetCellNumFmt} from './set_cell_num_fmt'
import {SetCellPatternFill} from './set_cell_pattern_fill'
import {SetLineAlignment} from './set_line_alignment'
import {SetLineBorder} from './set_line_border'
import {SetLineFont} from './set_line_font'
import {SetLineNumFmt} from './set_line_num_fmt'
import {SetLinePatternFill} from './set_line_pattern_fill'

export * from './set_cell_alignment'
export * from './set_cell_border'
export * from './set_cell_font'
export * from './set_cell_pattern_fill'
export * from './set_line_alignment'
export * from './set_line_border'
export * from './set_line_font'
export * from './set_line_pattern_fill'
export * from './set_cell_num_fmt'
export * from './set_line_num_fmt'
export * from './set_block_line_num_fmt'
export * from './set_block_line_name_field'

export type Payload =
    | EditPayload
    | {type: 'setCellAlignment'; value: SetCellAlignment}
    | {type: 'setCellBorder'; value: SetCellBorder}
    | {type: 'setCellFont'; value: SetCellFont}
    | {type: 'setCellPatternFill'; value: SetCellPatternFill}
    | {type: 'setLineAlignment'; value: SetLineAlignment}
    | {type: 'setLineBorder'; value: SetLineBorder}
    | {type: 'setLineFont'; value: SetLineFont}
    | {type: 'setLinePatternFill'; value: SetLinePatternFill}
    | {type: 'setCellNumFmt'; value: SetCellNumFmt}
    | {type: 'setLineNumFmt'; value: SetLineNumFmt}
    | {type: 'setBlockLineNumFmt'; value: SetBlockLineNumFmt}
    | {type: 'setBlockLineNameField'; value: SetBlockLineNameField}
