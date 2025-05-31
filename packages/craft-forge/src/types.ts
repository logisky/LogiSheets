/**
 * `CraftState` holds all the information that needs to be stored for the craft app.
 * It is not necessary to include the cell values in the `CraftState` because cell values
 * are automatically stored in the `LogiSheets`.
 *
 * `CraftState`s are also stored in `LogiSheets` platform. `LogiSheets` modifies the state
 * in cases where users rename field or restruct the craft app.
 *
 * TODO: Store the order of the fields and keys
 */
export interface CraftState {
    /**
     * In cases where a craft app is referencing another craft app,
     * `LogiSheets` will be the role to help calculate the coordinates of the referenced cell
     * and to help provide intellisense.
     */
    coordinateBinds: CoordinateBind[]

    horizontal: boolean

    fieldValidations: FieldValidation[]

    /**
     * A craft app can have multiple roles. Different roles have different behaviours on a
     * same app. This value is specified by the craft app.
     */
    role: string
}

export type CraftId = string
export type SheetId = number
export type BlockId = [SheetId, number]
export type RowId = number
export type ColId = number

export interface FieldValidation {
    id: string
    validation: string
}

export interface CoordinateBind {
    isKey: boolean
    // row id or col id, depending on the direction of the craft
    value: number
    // name of field or key
    name: string
}

export interface CraftSpecific {
    getCraftState(): CraftState
    loadCraftState(blockId: BlockId, craftState: CraftState): void
    stateChanged(): void
}

export const GetCraftStateMethodName = 'agent_getCraftState'

export interface GetCraftStateParams {
    craftId: CraftId
}

export interface GetCraftStateResp {
    state: CraftState
}
