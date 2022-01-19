import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {CanvasComponent} from './canvas.component'
import {SelectorModule} from '@logi-sheets/web/app/selector'
import {TextareaModule} from '@logi-sheets/web/app/textarea'
import {ScrollbarModule} from '@logi-sheets/web/app/scrollbar'
import {MatMenuModule} from '@angular/material/menu'
import {ContextMenuModule} from '@logi-sheets/web/app/context-menu'
import {CommentModule} from '@logi-sheets/web/app/comment'
import {DndModule} from '@logi-sheets/web/app/dnd'
import {ContextmenuDirective} from './contextmenu.directive'

@NgModule({
    declarations: [
        CanvasComponent,
        ContextmenuDirective,
    ],
    imports: [
        CommentModule,
        CommonModule,
        ContextMenuModule,
        DndModule,
        MatMenuModule,
        ScrollbarModule,
        SelectorModule,
        TextareaModule,
    ],
    exports: [
        CanvasComponent,
    ],
})
export class CanvasModule { }
