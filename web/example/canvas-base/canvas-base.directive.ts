import { Directive, ViewChild, ElementRef } from '@angular/core'

@Directive({
  selector: '[logiCanvasBase]'
})
export class CanvasBaseDirective {

    public get canvas(): HTMLCanvasElement {
        return this._canvas.nativeElement
    }

    public get ctx(): CanvasRenderingContext2D {
        const ctx = this.canvas.getContext('2d')
        if (!ctx)
            // tslint:disable-next-line: no-throw-unless-asserts
            throw Error('can not get ctx')
        return ctx
    }
    @ViewChild('canvas')
    private readonly _canvas!: ElementRef<HTMLCanvasElement>
}
