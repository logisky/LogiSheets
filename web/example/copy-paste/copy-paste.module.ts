import {CommonModule} from '@angular/common'
import {NgModule} from '@angular/core'

import {CopyPasteComponent} from './copy-paste.component'

@NgModule({
    declarations: [
        CopyPasteComponent,
    ],
    imports: [
        CommonModule,
    ],
    exports: [
        CopyPasteComponent,
    ],
})
export class CopyPasteModule { }
