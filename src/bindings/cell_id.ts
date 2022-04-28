import type { BlockCellId } from "./block_cell_id";
import type { NormalCellId } from "./normal_cell_id";

export type CellId = { NormalCell: NormalCellId } | { BlockCell: BlockCellId };