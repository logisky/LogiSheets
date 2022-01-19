import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {RectComponent} from './rect.component'
import {CanvasBaseModule} from '@logi-sheets/web/example/canvas-base'

@NgModule({
    declarations: [
        RectComponent,
    ],
    imports: [
        CanvasBaseModule,
        CommonModule,
    ],
    exports: [
        RectComponent,
    ],
})
export class RectModule { }
