import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {ScrollbarComponent} from './scrollbar.component'
import {ScrollbarService} from './service'

@NgModule({
    declarations: [
        ScrollbarComponent,
    ],
    imports: [
        CommonModule,
    ],
    exports: [
        ScrollbarComponent,
    ],
    providers: [ScrollbarService],
})
export class ScrollbarModule { }
