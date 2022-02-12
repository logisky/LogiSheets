import {ScrollbarType} from './scrollbar'
export class ScrollEvent {
    public type: ScrollbarType = 'x'
    public delta = 0
    public scrollDistance = 0
    public trust = false
}
