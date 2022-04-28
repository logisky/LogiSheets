import type { SheetBlocks } from "./sheet_blocks";
import type { SheetColInfo } from "./sheet_col_info";
import type { SheetComments } from "./sheet_comments";
import type { SheetMergeCells } from "./sheet_merge_cells";
import type { SheetNames } from "./sheet_names";
import type { SheetRowInfo } from "./sheet_row_info";
import type { SheetStyles } from "./sheet_styles";
import type { SheetValues } from "./sheet_values";

export type DisplayPatch = { values: SheetValues } | { styles: SheetStyles } | { rowInfo: SheetRowInfo } | { colInfo: SheetColInfo } | { mergeCells: SheetMergeCells } | { comments: SheetComments } | { blocks: SheetBlocks } | { sheetNames: SheetNames };