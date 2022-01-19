import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {DndComponent} from './dnd.component'

@NgModule({
    declarations: [
        DndComponent,
    ],
    imports: [
        CommonModule,
    ],
    exports: [
        DndComponent,
    ],
})
export class DndModule { }
