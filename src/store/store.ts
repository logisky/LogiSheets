import {makeObservable} from 'mobx'
import {createContext} from 'react'
import {Subject} from 'rxjs'
import {EventData} from './event'

export class GlobalStore {
    constructor() {
        makeObservable(this)
    }
    $event = new Subject<EventData>()

    purge() {
        this.$event.complete()
    }
}

export const GlobalContext = createContext({})
