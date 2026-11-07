import {makeAutoObservable} from 'mobx'
import {SETTINGS} from './service'
import {createContext} from 'react'

export class Settings {
    constructor() {
        makeAutoObservable(this)
    }

    settings = SETTINGS
}

// @ts-expect-error init data when use
export const SettingContext = createContext<Settings>({})
