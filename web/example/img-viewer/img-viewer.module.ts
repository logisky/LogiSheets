import {CommonModule} from '@angular/common'
import {NgModule} from '@angular/core'
import {FormsModule} from '@angular/forms'

import {ImgViewerComponent} from './img-viewer.component'

@NgModule({
    declarations: [
        ImgViewerComponent,
    ],
    exports: [
        ImgViewerComponent,
    ],
    imports: [
        CommonModule,
        FormsModule,
    ],
})
export class ImgViewerModule { }
