import {Component, AfterViewInit, ChangeDetectionStrategy} from '@angular/core'
import {CanvasBaseDirective} from '@logi-sheets/web/example/canvas-base'

@Component({
    selector: 'logi-text',
    templateUrl: './text.component.html',
    styleUrls: ['./text.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextComponent extends CanvasBaseDirective implements AfterViewInit {
    public ngAfterViewInit(): void {
        this.ctx.strokeStyle = 'green'
        this.ctx.moveTo(this.canvas.width / 2, 0)
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height)
        this.ctx.moveTo(this.canvas.width / 2, 10)
        this.ctx.lineTo(this.canvas.width / 2 + 500, 10)
        this.ctx.stroke()
        this.ctx.font = 'bold 30px Comic Sans MS'
        this.ctx.fillStyle = 'red'
        this.ctx.textAlign = 'start'
        this.ctx.direction = 'ltr'
        this.ctx.textBaseline = 'hanging'
        this.ctx.fillText('Hanging', this.canvas.width / 2, 10)
        this.ctx.strokeStyle = 'green'
        this.ctx.strokeText('stroke text', this.canvas.width / 2, 50)
        const measureText = this.ctx.measureText('measure text')
        console.log(measureText)
    }
}
