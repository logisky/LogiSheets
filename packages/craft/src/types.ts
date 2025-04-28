export interface CraftState {
    /**
     * In cases where a craft app is referencing another craft app,
     * `LogiSheets` will be the role to help calculate the coordinate of the referenced cell
     * and to help provide intellisense.
     */
    coordinateBinds: readonly CoordinateBind[]
}

export type CraftId = number
export type BlockId = number
export type RowId = number
export type ColId = number

export interface CoordinateBind {
    // if field is true, key is field name
    // else key is key name
    k: {value: string; field: boolean}
    // if row is true, v is row id
    // else v is col id
    v: {id: number; row: boolean}
}

export interface CraftSpecific {
    getCraftState(): CraftState
    loadCraftState(blockId: BlockId, craftState: CraftState): void
}

export const GetCraftStateMethodName = 'agent_getCraftState'

export interface GetCraftStateParams {
    craftId: CraftId
}

export interface GetCraftStateResp {
    state: CraftState
}
