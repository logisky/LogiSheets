// @ts-nocheck
// tslint:disable: no-magic-numbers brace-style
import {AfterViewInit, ChangeDetectionStrategy, Component} from '@angular/core'
import {CanvasBaseDirective} from '@logi-sheets/web/example/canvas-base'

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'logi-canvas',
    styleUrls: ['./canvas.component.scss'],
    templateUrl: './canvas.component.html',
})
export class CanvasComponent extends CanvasBaseDirective implements AfterViewInit {
    public ngAfterViewInit(): void {
        this.canvas.width = 400
        this.canvas.height = 300
        const lineWidth = 1
        this.ctx.lineWidth = lineWidth
        // const startX = 59.8
        // const startY = 100
        this.ctx.beginPath()
        this.ctx.moveTo(100, 59.8)
        this.ctx.lineTo(150, 59.8)
        this.ctx.stroke()
        this._eraseLine(110, 59.8, 20, lineWidth, lineWidth, 'h')
        // this.ctx.strokeRect(startX, startY, 40, 40)
        // this.ctx.strokeRect(50, 10, 40, 40)
        // this.ctx.strokeRect(90, 10, 40, 40)
        // this.ctx.strokeRect(startX, 50, 40, 40)
        // this.ctx.strokeRect(50, 50, 40, 40)
        // this.ctx.strokeRect(90, 50, 40, 40)
        // this.ctx.strokeRect(startX, startY, 40, 40)
        // this.ctx.strokeRect(50, 90, 40, 40)
        // this.ctx.strokeRect(90, 90, 40, 40)
        // this.ctx.strokeRect(10, 130, 40, 40)
        // this.ctx.strokeRect(50, 130, 40, 40)
        // this.ctx.strokeRect(90, 130, 40, 40)
        // this._eraseLine(10, 10, 40, lineWidth, lineWidth, 'h')
        // this._eraseLine(90, 10, lineWidth, 40, lineWidth, 'v')
        // this._eraseRect(10, 90, 40, 80, lineWidth)
        // this._eraseRect(50, 130, 80, 40, lineWidth)
        // this._lineJoin()
        // this._lineDash()
        // this._rect()
    }

    private _eraseLine(x, y, w, h, offset, position: 'v' | 'h') {
        console.log(this.ctx)
        this.ctx.save()
        position === 'h' ?
            this.ctx.clearRect(x, y - offset, w, h + 1) :
            this.ctx.clearRect(x - offset, y, w + 1, h)
        this.ctx.restore()
    }

    private _eraseRect(x, y, w, h, borderWidth) {
        this.ctx.save()
        const xx = x + borderWidth
        const yy = y + borderWidth
        this.ctx.clearRect(xx, yy, w - borderWidth * 2, h - borderWidth * 2)
        this.ctx.restore()
    }

    private _line(x1, y1, x2, y2): void {
        this.ctx.save()
        this.ctx.beginPath()
        this.ctx.moveTo(x1, y1)
        this.ctx.lineTo(x2, y2)
        this.ctx.stroke()
        this.ctx.restore()
    }

    private _lineJoin(): void {
        const data = [[30, 20], [100, 50], [20, 70]]
        const draw = (d: number[][], lineJoin: CanvasLineJoin) => {
            this.ctx.beginPath()
            this.ctx.moveTo(d[0][0], d[0][1])
            this.ctx.lineTo(d[1][0], d[1][1])
            this.ctx.lineTo(d[2][0], d[2][1])
            this.ctx.stroke()
            this.ctx.lineJoin = lineJoin
        }
        draw(data, 'bevel')
        draw(data.map(d => {d[0] += 100; return d}), 'miter')
        draw(data.map(d => {d[0] += 200; return d}), 'round')
    }

    private _lineDash(): void {
        this.ctx.beginPath()
        this.ctx.setLineDash([10,2,3,4])
        this.ctx.moveTo(10, 120)
        this.ctx.lineTo(200, 120)
        this.ctx.strokeStyle = 'purple'
        this.ctx.stroke()
    }

    private _rect(): void {
        this.ctx.save()
        this.ctx.fillStyle = 'red'
        this.ctx.fillRect(0, 0, 10, 20)
        this.ctx.restore()
    }
}
