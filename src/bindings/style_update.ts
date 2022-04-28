import type { StyleUpdateType } from "./style_update_type";

export interface StyleUpdate { sheetIdx: number, row: number, col: number, ty: StyleUpdateType, }