import {
    ElementRef,
    Component,
    AfterViewInit,
    ChangeDetectionStrategy,
} from '@angular/core'
import {fromEvent} from 'rxjs'

@Component({
    selector: 'logi-mouseevent',
    templateUrl: './mouseevent.component.html',
    styleUrls: ['./mouseevent.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MouseeventComponent implements AfterViewInit {
    constructor(
        private readonly _el: ElementRef<HTMLElement>,
    ) {}
    ngAfterViewInit(): void {
        /**
         * https://www.programmersought.com/article/9238892493/
         */
        const el = this._el.nativeElement
        fromEvent<MouseEvent>(el, 'mousedown').subscribe(e => {
            console.log(e)
            console.log(e.x, e.pageX, e.clientX, e.offsetX, e.screenX)
        })
    }
}
