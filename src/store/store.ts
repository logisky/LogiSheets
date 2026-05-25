import {makeObservable, observable, action} from 'mobx'
import {createContext} from 'react'
import {Subject} from 'rxjs'
import {EventData} from './event'

export class GlobalStore {
    constructor() {
        makeObservable(this)
    }
    $event = new Subject<EventData>()

    @observable isTempMode = false

    @action setTempMode(v: boolean) {
        this.isTempMode = v
    }

    // When true, block overlays (border, settings button, field headers,
    // add-row button) are always shown. When false (default), they only
    // appear while the mouse is over the block.
    @observable alwaysShowBlockInfo = false

    @action setAlwaysShowBlockInfo(v: boolean) {
        this.alwaysShowBlockInfo = v
    }

    purge() {
        this.$event.complete()
    }
}

export const globalStore = new GlobalStore()

export const GlobalContext = createContext({})
