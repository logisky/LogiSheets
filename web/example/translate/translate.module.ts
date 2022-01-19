import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {TranslateComponent} from './translate.component'
import {CanvasBaseModule} from '@logi-sheets/web/example/canvas-base'

@NgModule({
    declarations: [
        TranslateComponent,
    ],
    imports: [
        CanvasBaseModule,
        CommonModule,
    ],
    exports: [
        TranslateComponent,
    ],
})
export class TranslateModule { }
