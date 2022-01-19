import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {TextContainerComponent} from './text-container.component'
import {CursorModule} from './cursor'
import {SuggestModule} from '@logi-sheets/web/app/suggest'

@NgModule({
    declarations: [
        TextContainerComponent,
    ],
    imports: [
        CommonModule,
        CursorModule,
        SuggestModule,
    ],
    exports: [
        TextContainerComponent,
    ],
})
export class TextareaModule { }
