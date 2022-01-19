import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {GridComponent} from './grid.component'
import {CanvasBaseModule} from '@logi-sheets/web/example/canvas-base'

@NgModule({
    declarations: [
        GridComponent,
    ],
    imports: [
        CanvasBaseModule,
        CommonModule,
    ],
    exports: [
        GridComponent,
    ],
})
export class GridModule { }
