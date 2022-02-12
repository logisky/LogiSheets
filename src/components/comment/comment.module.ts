import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {CommentComponent} from './comment.component'
import {CommentService} from './service'

@NgModule({
    declarations: [
        CommentComponent,
    ],
    imports: [
        CommonModule,
    ],
    exports: [
        CommentComponent,
    ],
    providers: [CommentService],
})
export class CommentModule { }
