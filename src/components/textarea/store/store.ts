import {action, makeObservable, observable} from 'mobx'
import {createContext} from 'react'
import {Cursor} from './cursor'
import {Context} from '../defs'
import {TextManager} from './text'
import {Suggest} from './suggest'
import {Selection} from './selection'

export class TextareaStore {
    constructor(public readonly context: Context) {
        makeObservable(this)
        this.textManager = new TextManager(this)
        this.cursor = new Cursor(this)
        this.suggest = new Suggest(this)
        this.selection = new Selection(this)
    }
    @observable
    isComposing = false

    isMousedown = false

    @action
    setComposing(isComposing: boolean) {
        this.isComposing = isComposing
    }

    selection: Selection
    cursor: Cursor
    textManager: TextManager
    suggest: Suggest
}

// @ts-expect-error inject data when use context
export const TextareaContext = createContext<TextareaStore>({})
