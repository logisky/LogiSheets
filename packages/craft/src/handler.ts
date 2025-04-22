import {Client as WorkbookClient} from 'logisheets-web'
import {CraftId, CraftState} from './types'

export interface CraftHandler extends WorkbookClient {
    getCraftState(craftId: CraftId): Promise<CraftState>
}
