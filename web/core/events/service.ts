import {FromEventTarget} from 'rxjs/internal/observable/fromEvent'
import {Observable, fromEvent} from 'rxjs'
import {EventType} from './event'
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface TotalEventsHandlersEventMap extends ClipboardEventHandlersEventMap {}
export function on<K extends keyof TotalEventsHandlersEventMap>(
    el: FromEventTarget<TotalEventsHandlersEventMap[K]>,
    event: K,
): Observable<TotalEventsHandlersEventMap[K]> {
    return fromEvent<TotalEventsHandlersEventMap[K]>(el, event)
}
interface ClipboardEventHandlersEventMap extends GlobalEventHandlersEventMap {
    readonly [EventType.COPY]: ClipboardEvent,
    readonly [EventType.CUT]: ClipboardEvent,
    readonly [EventType.PASTE]: ClipboardEvent,
}
