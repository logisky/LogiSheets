import {makeAutoObservable} from 'mobx'
import {ScrollbarType} from '../types'
import { Cell } from '@/components/canvas'

export class ScrollbarStore {
    constructor(public readonly direction: ScrollbarType) {
        makeAutoObservable(this, {}, {autoBind: true})
    }
    offsetHeight = 0
    scrollHeight = 0
    scrollTop = 0
    minThumbLength = 20
    setScrollTop (scrollTop: number)  {
        this.scrollTop = scrollTop
    }
}
export const xScrollbarStore = new ScrollbarStore('x')
export const yScrollbarStore = new ScrollbarStore('y')