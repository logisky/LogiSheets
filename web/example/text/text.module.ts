import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {TextComponent} from './text.component'
import {CanvasBaseModule} from '@logi-sheets/web/example/canvas-base'

@NgModule({
    declarations: [
        TextComponent,
    ],
    imports: [
        CanvasBaseModule,
        CommonModule,
    ],
    exports: [
        TextComponent,
    ],
})
export class TextModule { }
