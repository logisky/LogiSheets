import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {StartComponent} from './start.component'
import {ColorPickerModule} from '@logi-sheets/web/app/color-picker'

@NgModule({
    declarations: [
        StartComponent,
    ],
    imports: [
        ColorPickerModule,
        CommonModule,
    ],
    exports: [
        StartComponent,
    ],
})
export class ContentModule { }
