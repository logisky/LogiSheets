import {EditPayload} from '../bindings'
import {SetCellAlignment} from './set_cell_alignment'
import {SetCellBorder} from './set_cell_border'
import {SetCellFont} from './set_cell_font'
import {SetCellPatternFill} from './set_cell_pattern_fill'
import {SetLineAlignment} from './set_line_alignment'
import {SetLineBorder} from './set_line_border'
import {SetLineFont} from './set_line_font'
import {SetLinePatternFill} from './set_line_pattern_fill'

export * from './set_cell_alignment'
export * from './set_cell_border'
export * from './set_cell_font'
export * from './set_cell_pattern_fill'
export * from './set_line_alignment'
export * from './set_line_border'
export * from './set_line_font'
export * from './set_line_pattern_fill'

export type Payload =
    | EditPayload
    | SetCellAlignment
    | SetCellBorder
    | SetCellFont
    | SetCellPatternFill
    | SetLineAlignment
    | SetLineBorder
    | SetLineFont
    | SetLinePatternFill
