import {Client as WorkbookClient} from 'logisheets-web'
import {CraftId, CraftState} from './types'

export interface CraftHandler extends WorkbookClient {
    getCraftState(craftId: CraftId): Promise<CraftState>
    getAllKeys(craftId: CraftId): Promise<string[]>
    getAllFields(craftId: CraftId): Promise<string[]>
    getCoordinate(
        craftId: CraftId,
        key: string,
        value: string
    ): Promise<{row: number; col: number}>
}
