import {DataBlock, DataField, DataFieldBuilder, DataValue} from './data'
import {CraftAgent} from '../agent'
import {BlockId, CraftState} from '../types'

export abstract class CraftApp {
    public constructor() {
        /**
         * Every craft app should import a craft agent first.
         * CraftAgent is the bridge between CraftApp and LogiSheets platform.
         */
        this._agent = new CraftAgent()
        this._agent.setGetCraftState(this.getCraftState)
    }

    public abstract getCraftState(): CraftState

    private _agent: CraftAgent
}
