import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {FormsModule, ReactiveFormsModule} from '@angular/forms'
import {MatDialogModule} from '@angular/material/dialog'
import {CanvasComponent} from './canvas.component'
import {SelectorModule} from '@logi-sheets/web/app/selector'
import {TextareaModule} from '@logi-sheets/web/app/textarea'
import {ScrollbarModule} from '@logi-sheets/web/app/scrollbar'
import {MatMenuModule} from '@angular/material/menu'
import {MatButtonModule} from '@angular/material/button'
import {ContextMenuModule} from '@logi-sheets/web/app/context-menu'
import {CommentModule} from '@logi-sheets/web/app/comment'
import {DndModule} from '@logi-sheets/web/app/dnd'
import {ContextmenuDirective} from './contextmenu.directive'
import {SelectBlockComponent} from './select-block.component'
import {MatCheckboxModule} from '@angular/material/checkbox'

@NgModule({
    declarations: [
        CanvasComponent,
        ContextmenuDirective,
        SelectBlockComponent,
    ],
    imports: [
        CommentModule,
        CommonModule,
        ContextMenuModule,
        DndModule,
        FormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatDialogModule,
        MatMenuModule,
        ReactiveFormsModule,
        ScrollbarModule,
        SelectorModule,
        TextareaModule,
    ],
    exports: [
        CanvasComponent,
    ],
})
export class CanvasModule { }
