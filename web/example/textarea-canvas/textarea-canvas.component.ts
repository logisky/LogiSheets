import {
    Component,
    AfterViewInit,
    ElementRef,
    ViewChild,
    ChangeDetectionStrategy,
} from '@angular/core'

@Component({
    selector: 'logi-textarea-canvas',
    templateUrl: './textarea-canvas.component.html',
    styleUrls: ['./textarea-canvas.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextareaCanvasComponent implements AfterViewInit {
    ngAfterViewInit(): void {
        const text = this._textCanvas.nativeElement
        const selection = this._selectionCanvas.nativeElement
        const textContext = text.getContext('2d')
        const selContext = selection.getContext('2d')
        if (!textContext || !selContext)
            // tslint:disable-next-line: no-throw-unless-asserts
            throw Error('error in get context')
        this._setFontInfo(textContext)
        this._setFontInfo(selContext)
        text.width = 200
        selection.width = 200
        text.height = 200
        selection.height = 200
        const texts = ['111333', '222222222222222222222']
        texts.forEach((t, i) => {
            textContext.fillText(t, 0, (i + 1) * 30)
        })
        selContext.fillStyle = 'rgba(0,0,0,0.38)'
        selContext.fillRect(0, 20, 10, 10)
        selContext.fillRect(5, 50, 50, 10)
        this._textarea.nativeElement.addEventListener('focus', e => {
            console.log('textarea receive focus', e)
        })
    }
    @ViewChild('textCanvas')
    private readonly _textCanvas!: ElementRef<HTMLCanvasElement>
    @ViewChild('selectionCanvas')
    private readonly _selectionCanvas!: ElementRef<HTMLCanvasElement>
    @ViewChild('textarea')
    private readonly _textarea!: ElementRef<HTMLTextAreaElement>
    private _setFontInfo(ctx: CanvasRenderingContext2D): void {
        ctx.font = 'bold 30px Comic Sans MS'
        ctx.fillStyle = 'red'
        ctx.textAlign = 'start'
        ctx.direction = 'ltr'
        ctx.textBaseline = 'hanging'
    }
}
