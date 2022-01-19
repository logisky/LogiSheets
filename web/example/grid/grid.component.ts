import {Component, AfterViewInit, ChangeDetectionStrategy} from '@angular/core'
import {CanvasBaseDirective} from '@logi-sheets/web/example/canvas-base'

@Component({
    selector: 'logi-grid',
    templateUrl: './grid.component.html',
    styleUrls: ['./grid.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridComponent extends CanvasBaseDirective implements AfterViewInit {
    public ngAfterViewInit(): void {
        const ctx = this.ctx
        ctx.setLineDash([10, 10])
        ctx.moveTo(10, 10)
        ctx.lineTo(10000, 10)
        ctx.stroke()
        // const el = this.canvas
        // const count = 1200
        // ctx.strokeStyle = 'black'
        // ctx.fillStyle = 'red'
        // const region = new Path2D()
        // for (let i = 0; i < count; i += 10) {
        //     region.moveTo(i, 0)
        //     region.lineTo(i, el.height)
        // }
        // for (let i = 0; i < count; i += 10) {
        //     region.moveTo(0, i)
        //     region.lineTo(el.width, i)
        // }
        // ctx.lineWidth = 0.5
        // ctx.stroke(region)
        // ctx.fill(region)
    }
}
