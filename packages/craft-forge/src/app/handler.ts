import {Client as WorkbookClient} from 'logisheets-web'
import {BlockId, CraftState} from './types'

export interface CraftHandler extends WorkbookClient {
    getCraftState(blockId: BlockId): Promise<CraftState>
}
