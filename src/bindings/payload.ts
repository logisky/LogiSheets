import type { BlockInput } from "./block_input";
import type { BlockStyleUpdate } from "./block_style_update";
import type { CellInput } from "./cell_input";
import type { ColShift } from "./col_shift";
import type { CreateBlock } from "./create_block";
import type { LineShiftInBlock } from "./line_shift_in_block";
import type { MoveBlock } from "./move_block";
import type { RowShift } from "./row_shift";
import type { SetColWidth } from "./set_col_width";
import type { SetRowHeight } from "./set_row_height";
import type { SetVisible } from "./set_visible";
import type { SheetRename } from "./sheet_rename";
import type { StyleUpdate } from "./style_update";

export type EditPayload = { BlockInput: BlockInput } | { BlockStyleUpdate: BlockStyleUpdate } | { CellInput: CellInput } | { ColShift: ColShift } | { CreateBlock: CreateBlock } | { LineShiftInBlock: LineShiftInBlock } | { MoveBlock: MoveBlock } | { RowShift: RowShift } | { SetColWidth: SetColWidth } | { SetRowHeight: SetRowHeight } | { StyleUpdate: StyleUpdate } | { SheetRename: SheetRename } | { SetVisible: SetVisible };