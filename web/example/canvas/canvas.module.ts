import {CommonModule} from '@angular/common'
import {NgModule} from '@angular/core'
import {CanvasBaseModule} from '@logi-sheets/web/example/canvas-base'

import {CanvasComponent} from './canvas.component'

@NgModule({
    declarations: [CanvasComponent],
    exports: [CanvasComponent],
    imports: [
        CanvasBaseModule,
        CommonModule,
    ],
})
export class CanvasModule { }
