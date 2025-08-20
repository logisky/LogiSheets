export * from './types'
export * from '../button'
export * from './agent'
export * from './handler'

import {CraftAgent} from './agent'
import {BlockId, CoordinateBind, CraftState} from './types'
import {
    Payload,
    BlockInputBuilder,
    isErrorMessage,
    Transaction,
} from 'logisheets-web'

/**
 * Decorator that indicates a method mutates the state and automatically triggers state change notification
 */
export function mutateState(): MethodDecorator {
    return (
        _target: object,
        _propertyKey: string | symbol,
        descriptor: PropertyDescriptor
    ): PropertyDescriptor => {
        const originalMethod = descriptor.value
        if (!originalMethod) return descriptor

        descriptor.value = async function (
            this: CraftApp,
            ...args: unknown[]
        ): Promise<void> {
            await originalMethod.apply(this, args)
            this._agent?.stateChanged()
        }

        return descriptor
    }
}

export abstract class CraftApp {
    public constructor(
        public readonly blockId: BlockId,
        public state: CraftState
    ) {
        /**
         * Every craft app should import a craft agent first.
         * CraftAgent is the bridge between CraftApp and LogiSheets platform.
         */
        this._agent = new CraftAgent()
        this._agent.setGetCraftState(this.getCraftState)
        this._state = state
    }

    public getCraftState(): CraftState {
        return this._state
    }

    @mutateState()
    public async createField(
        fieldId: string,
        idx: number,
        validation?: string
    ): Promise<void> {
        let id: number
        if (this._state.horizontal) {
            const result = await this._agent.getBlockRowId({
                sheetId: this.blockId[0],
                blockId: this.blockId[1],
                rowIdx: idx,
            })
            if (isErrorMessage(result)) throw Error('failed to get row id')
            id = result
        } else {
            const result = await this._agent.getBlockColId({
                sheetId: this.blockId[0],
                blockId: this.blockId[1],
                colIdx: idx,
            })
            if (isErrorMessage(result)) throw Error('failed to get col id')
            id = result
        }
        const existed = this._state.coordinateBinds.find((v) => {
            if (v.isKey) return false
            if (v.value === id) return true
            return false
        })
        if (existed) throw Error('has already been registered')
        const result = await this._agent.handleTransaction({
            transaction: new Transaction(
                [
                    {
                        type: 'blockInput',
                        value: new BlockInputBuilder()
                            .sheetIdx(this.blockId[0])
                            .blockId(this.blockId[1])
                            .row(this._state.horizontal ? 0 : idx)
                            .col(this._state.horizontal ? idx : 0)
                            .input(fieldId)
                            .build(),
                    },
                ],
                true
            ),
        })
        if (isErrorMessage(result)) throw Error(result.msg)
        const bind: CoordinateBind = {isKey: false, value: id, name: fieldId}
        this._state.coordinateBinds.push(bind)
        if (validation)
            this._state.fieldValidations.push({id: fieldId, validation})
    }

    protected _agent: CraftAgent
    private _state: CraftState = {
        horizontal: false,
        coordinateBinds: [],
        fieldValidations: [],
        role: '',
    }
}
