import {Component, AfterViewInit, ChangeDetectionStrategy} from '@angular/core'
import {CanvasBaseDirective} from '@logi-sheets/web/example/canvas-base'

@Component({
    selector: 'logi-rect',
    templateUrl: './rect.component.html',
    styleUrls: ['./rect.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RectComponent extends CanvasBaseDirective implements AfterViewInit {
    public ngAfterViewInit(): void {
        /**
         * merge cells
         */
        this.canvas.width = 500
        this.canvas.height = 500
        this.ctx.save()
        this.rect(25, 25, 200, 200)
        this.rect(225, 25, 200, 200)
        this.rect(25, 225, 200, 200)
        this.rect(225, 225, 200, 200)
        // this.ctx.rect(25, 25, 200, 200)
        // this.ctx.stroke()
        // this.ctx.rect(225, 25, 200, 200)
        // this.ctx.stroke()
        // this.ctx.rect(25, 225, 200, 200)
        // this.ctx.stroke()
        // this.ctx.rect(225, 225, 200, 200)
        // this.ctx.stroke()
        // this.ctx.fillStyle = 'black'
        // this.ctx.rect(0, 0, 100, 200)
        this.ctx.restore()
        this.ctx.clip()
        this.ctx.fillStyle = 'white'
        // this.ctx.rect(25, 25, 400, 25)
        this.ctx.fillRect(25, 25, 400, 200)
        // this.ctx.fill()
        this.ctx.restore()
        this.ctx.save()
        this.ctx.font = 'bold 30px Comic Sans MS'
        this.ctx.textBaseline = 'hanging'
        this.ctx.fillText('hello', 25, 25)
        this.ctx.restore()
    }

    rect(x: number, y: number, width: number, height: number): void {
        this.ctx.strokeStyle = 'red'
        this.ctx.moveTo(x, y)
        this.ctx.lineTo(x + width, y)
        this.ctx.lineTo(x + width, y + height)
        this.ctx.lineTo(x, y + height)
        this.ctx.closePath()
        this.ctx.stroke()
    }
}
