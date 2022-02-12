import {
    Component,
    Inject,
    ChangeDetectionStrategy,
    InjectionToken,
} from '@angular/core'
import {Comment} from '@logi-pb/network/src/proto/message_pb'
export const LOGI_SHEETS_COMMENT_DATA = new InjectionToken('logi-sheets-comment-data')

@Component({
    selector: 'logi-comment',
    templateUrl: './comment.component.html',
    styleUrls: ['./comment.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentComponent {
    constructor(
        @Inject(LOGI_SHEETS_COMMENT_DATA)
        public readonly comment: Comment,
    ) {
    }
}
