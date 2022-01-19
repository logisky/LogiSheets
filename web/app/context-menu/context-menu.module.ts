import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {ContextMenuComponent} from './context-menu.component'
import {ContextMenuService} from './service'

@NgModule({
    declarations: [
        ContextMenuComponent,
    ],
    imports: [
        CommonModule,
    ],
    exports: [
        ContextMenuComponent,
    ],
    providers: [ContextMenuService],
})
export class ContextMenuModule { }
