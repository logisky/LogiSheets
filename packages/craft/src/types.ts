export interface CraftState {}

export type CraftId = number
export type BlockId = number
export type RowId = number
export type ColId = number

export interface CraftSpecific {
    getCraftState(): CraftState
}

export const GetCraftStateMethodName = 'agent_getCraftState'

export interface GetCraftStateParams {
    craftId: CraftId
}

export interface GetCraftStateResp {
    state: CraftState
}
