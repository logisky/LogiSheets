import type { StyleUpdateType } from "./style_update_type";

export interface BlockStyleUpdate { sheetIdx: number, blockId: number, row: number, col: number, styleUpdate: StyleUpdateType, }