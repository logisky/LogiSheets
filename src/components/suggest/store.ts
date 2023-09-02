import {makeAutoObservable} from 'mobx'
import { Candidate } from './item'

export class SuggestStore {
    constructor() {
        makeAutoObservable(this, {}, {autoBind: true})
    }
    show = false
    candidates: Candidate[] = []
    acitveCandidate = -1
    selectedCandidate = -1
}
export const suggestStore = new SuggestStore()