import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {MatButtonModule} from '@angular/material/button'
import {ReactiveFormsModule, FormsModule} from '@angular/forms'
import {SheetsTabComponent} from './sheets-tab.component'
import {RenameComponent} from './rename.component'
import {MatDialogModule} from '@angular/material/dialog'
import {MatInputModule} from '@angular/material/input'
import {ContextMenuModule} from '@logi-sheets/web/app/context-menu'
import {SheetTabContextMenuDirective} from './contextmenu.directive'

@NgModule({
    declarations: [
        RenameComponent,
        SheetTabContextMenuDirective,
        SheetsTabComponent,
    ],
    imports: [
        CommonModule,
        ContextMenuModule,
        FormsModule,
        MatButtonModule,
        MatDialogModule,
        MatInputModule,
        ReactiveFormsModule,
    ],
    exports: [
        SheetsTabComponent,
    ],
})
export class SheetsTabModule { }
