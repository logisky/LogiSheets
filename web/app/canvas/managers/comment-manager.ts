import {Injectable, OnDestroy} from '@angular/core'
import {CommentService, PositionBuilder} from '@logi-sheets/web/app/comment'
import {DataService} from '@logi-sheets/web/core/data'
import {StartCellEvent, StartCellManager} from './start-cell-manager'
import {Subscription} from 'rxjs'

@Injectable({providedIn: 'root'})
export class CommentManager extends Subscription
    implements OnDestroy {
    constructor(
        public readonly commentSvc: CommentService,
        public readonly dataSvc: DataService,
        public readonly startCellMng: StartCellManager,
    ) {
        super()
        this._init()
    }

    ngOnDestroy() {
        this.unsubscribe()
    }

    mousedown(e?: StartCellEvent): void {
        if (e === undefined) {
            this.commentSvc.closePanel()
            return
        }
        if (e.from !== 'mousedown')
            return
        const cell = this.dataSvc.cachedViewRange.cells
            .find(c => c.coodinate.cover(e.cell.coodinate))
        if (cell === undefined) {
            this.commentSvc.closePanel()
            return
        }
        const comment = this.dataSvc.sheetSvc
            .getSheet()
            ?.getComment(cell.coodinate.startRow, cell.coodinate.startCol)
        if (comment === undefined) {
            this.commentSvc.closePanel()
            return
        }
        const rect = e.element.getBoundingClientRect()
        if (cell === undefined) {
            this.commentSvc.closePanel()
            return
        }
        const position = new PositionBuilder()
            .x(rect.x + cell.position.endCol)
            .y(rect.y + cell.position.startRow)
            .build()
        this.commentSvc.openPanel(comment, position)
    }

    private _init(): void {
        this.add(this.startCellMng.startCell$().subscribe(e => {
            this.mousedown(e)
        }))
    }
}
