import {HasEventTargetAddRemove} from 'rxjs/internal/observable/fromEvent'
import {fromEvent} from 'rxjs'
import {EventType} from './event'
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface TotalEventsHandlersEventMap extends ClipboardEventHandlersEventMap {}
export function on<K extends keyof TotalEventsHandlersEventMap>(
    el: HasEventTargetAddRemove<TotalEventsHandlersEventMap[K]>,
    event: K,
)  {
    return fromEvent(el, event)
}
interface ClipboardEventHandlersEventMap extends GlobalEventHandlersEventMap {
    readonly [EventType.COPY]: ClipboardEvent,
    readonly [EventType.CUT]: ClipboardEvent,
    readonly [EventType.PASTE]: ClipboardEvent,
}
