export interface CraftState {}

export type CraftId = number
export type BlockId = number
export type RowId = number
export type ColId = number

export interface CraftSpecific {
    getCraftState(): CraftState
    getAllKeys(): string[]
    getAllFields(): string[]
    getCoordinate(key: string, value: string): {row: number; col: number}
}

export const GetCraftStateMethodName = 'agent_getCraftState'
export const GetAllKeysMethodName = 'agent_getAllKeys'
export const GetAllFieldsMethodName = 'agent_getAllFields'
export const GetCoordinateMethodName = 'agent_getCoordinate'

export interface GetCraftStateParams {
    craftId: CraftId
}

export interface GetCraftStateResp {
    state: CraftState
}
