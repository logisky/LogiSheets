import {CommonModule} from '@angular/common'
import {NgModule} from '@angular/core'
import {CanvasModule} from '@logi-sheets/web/app/canvas'
import {FormsModule, ReactiveFormsModule} from '@angular/forms'

import {ContentComponent} from './content.component'
import {SheetsTabModule} from '@logi-sheets/web/app/sheets-tab'
import {EditBarComponent} from './edit-bar.component'
import {ScrollbarModule} from '@logi-sheets/web/app/scrollbar'

@NgModule({
    declarations: [
        ContentComponent,
        EditBarComponent,
    ],
    imports: [
        CanvasModule,
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        ScrollbarModule,
        SheetsTabModule,
    ],
    exports: [
        ContentComponent,
    ],
})
export class ContentModule { }
