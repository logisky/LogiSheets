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

    purge() {
        this.$event.complete()
    }
}

export const globalStore = new GlobalStore()

export const GlobalContext = createContext({})
