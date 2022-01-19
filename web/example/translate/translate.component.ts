import {Component, AfterViewInit, ChangeDetectionStrategy} from '@angular/core'
import {CanvasBaseDirective} from '@logi-sheets/web/example/canvas-base'

@Component({
    selector: 'logi-translate',
    templateUrl: './translate.component.html',
    styleUrls: ['./translate.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TranslateComponent extends CanvasBaseDirective implements AfterViewInit {
    public ngAfterViewInit(): void {
        this.ctx.strokeStyle = 'green'
        this.ctx.lineWidth = 5
        this.ctx.translate(100, 0)
        this.ctx.moveTo(0, 0)
        this.ctx.lineTo(50, 0)
        this.ctx.stroke()
        this.ctx.beginPath()
        this.ctx.strokeStyle = 'red'
        this.ctx.translate(50, 0)
        this.ctx.moveTo(0, 0)
        this.ctx.lineTo(100, 0)
        this.ctx.stroke()
    }
}
