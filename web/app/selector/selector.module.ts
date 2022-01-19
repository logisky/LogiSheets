import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {SelectorComponent} from './selector.component'

@NgModule({
    declarations: [
        SelectorComponent,
    ],
    imports: [
        CommonModule,
    ],
    exports: [
        SelectorComponent,
    ],
})
export class SelectorModule { }
