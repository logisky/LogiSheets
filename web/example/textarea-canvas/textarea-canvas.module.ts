import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {TextareaCanvasComponent} from './textarea-canvas.component'

@NgModule({
    declarations: [
        TextareaCanvasComponent,
    ],
    imports: [
        CommonModule,
    ],
    exports: [
        TextareaCanvasComponent,
    ],
})
export class TextareaCanvasModule { }
