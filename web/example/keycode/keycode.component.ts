import {
    Component,
    ElementRef,
    ViewChild,
    ChangeDetectionStrategy,
} from '@angular/core'
import {fromEvent} from 'rxjs'

@Component({
    selector: 'logi-keycode',
    templateUrl: './keycode.component.html',
    styleUrls: ['./keycode.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeycodeComponent {
    ngAfterViewInit(): void {
        fromEvent<KeyboardEvent>(this.input.nativeElement, 'keydown')
            .subscribe(e => {
                console.log(e.key, e.code)
            })
    }
    @ViewChild('input') private readonly input!: ElementRef<HTMLInputElement>
}
