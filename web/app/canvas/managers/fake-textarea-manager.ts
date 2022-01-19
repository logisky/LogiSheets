import {Subject, Observable, Subscription} from 'rxjs'
import {on, EventType} from '@logi-sheets/web/core/events'
export class FakeTextAreaManager extends Subscription {
    constructor(
        public readonly textarea: HTMLTextAreaElement
    ) {
        super()
    }
    get keydown$(): Observable<KeyboardEvent> {
        return this._keydown$
    }

    setActive(): void {
        this.textarea.focus()
    }

    listen(): void {
        this.add(on(this.textarea, EventType.KEY_DOWN).subscribe(e => {
            this._keydown$.next(e)
        }))
    }
    private _keydown$ = new Subject<KeyboardEvent>()
}
