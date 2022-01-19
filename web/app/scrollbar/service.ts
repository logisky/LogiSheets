import {Injectable, OnDestroy} from '@angular/core'
import {Subject, Observable, merge} from 'rxjs'
import {ScrollEvent} from './scroll_event'

@Injectable()
export class ScrollbarService implements OnDestroy {
    ngOnDestroy(): void {
        this._mouseMoving$.complete()
        this._mouseWheelScrolling$.complete()
    }

    onScrolling(): Observable<ScrollEvent> {
        return merge(this._mouseMoving$, this._mouseWheelScrolling$)
    }

    mouseMoveScrolling(mouseMoving: ScrollEvent): void {
        this._mouseMoving$.next(mouseMoving)
    }

    mouseWheelScrolling(mouseWheelScrolling: ScrollEvent): void {
        this._mouseWheelScrolling$.next(mouseWheelScrolling)
    }
    private _mouseMoving$ = new Subject<ScrollEvent>()
    private _mouseWheelScrolling$ = new Subject<ScrollEvent>()
}
