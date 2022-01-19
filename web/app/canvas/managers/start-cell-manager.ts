import {Builder} from '@logi-base/src/ts/common/builder'
import {Subscription, Observable, Subject} from 'rxjs'
import {Cell, CellBuilder} from './cell'
import {DataService} from '@logi-sheets/web/core/data'
import {match} from './match'
import {Injectable, OnDestroy} from '@angular/core'

@Injectable({providedIn: 'root'})
export class StartCellManager extends Subscription implements OnDestroy {
    constructor(
        public readonly dataSvc: DataService,
    ) {
        super()
    }
    get startCell() {
        return this._startCell
    }

    ngOnDestroy() {
        this.unsubscribe()
    }

    startCell$(): Observable<StartCellEvent | undefined> {
        return this._startCell$
    }

    rendered(canvas: HTMLCanvasElement): void {
        const viewRange = this.dataSvc.cachedViewRange
        const oldCell = this._startCell
        const row = viewRange.rows.find(r => oldCell.cover(r))
        if (row === undefined) {
            this._startCell$.next(undefined)
            return
        }
        const col = viewRange.cols.find(c => oldCell.cover(c))
        if (col === undefined) {
            this._startCell$.next(undefined)
            return
        }
        this._startCell = new CellBuilder().type(oldCell.type).build()
        const event = new StartCellEventBuilder()
            .cell(this._startCell)
            .from('render')
            .same(false)
            .element(canvas)
            .build()
        this._startCell$.next(event)
    }

    mousedown(e: MouseEvent, canvas: HTMLCanvasElement): void {
        const matchCell = match(e.clientX, e.clientY, this.dataSvc, canvas)
        const event = new StartCellEventBuilder()
            .cell(matchCell)
            .from('mousedown')
            .element(canvas)
            .event(e)
        if (matchCell.equals(this._startCell))
            event.same(true)
        this._startCell = matchCell
        this._startCell$.next(event.build())
    }

    contextmenu(e: MouseEvent, canvas: HTMLCanvasElement): void {
        const matchCell = match(e.clientX, e.clientY, this.dataSvc, canvas)
        const event = new StartCellEventBuilder()
            .cell(matchCell)
            .from('contextmenu')
            .element(canvas)
            .event(e)
        if (matchCell.equals(this._startCell))
            event.same(true)
        this._startCell = matchCell
        this._startCell$.next(event.build())
    }
    private _startCell = new CellBuilder().build()
    private _startCell$ = new Subject<StartCellEvent | undefined>()
}
export type StartCellType = 'mousedown' | 'contextmenu' | 'render' | 'unknown'
export interface StartCellEvent {
    readonly from: StartCellType
    readonly cell: Cell
    readonly event: Event
    readonly same: boolean
    readonly element: HTMLCanvasElement
}

class StartCellEventImpl implements StartCellEvent {
    public from: StartCellType = 'unknown'
    public cell!: Cell
    public event = new Event('')
    public same = false
    public element!: HTMLCanvasElement
}

export class StartCellEventBuilder extends Builder<StartCellEvent, StartCellEventImpl> {
    public constructor(obj?: Readonly<StartCellEvent>) {
        const impl = new StartCellEventImpl()
        if (obj)
            StartCellEventBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public from(from: StartCellType): this {
        this.getImpl().from = from
        return this
    }

    public cell(cell: Cell): this {
        this.getImpl().cell = cell
        return this
    }

    public event(event: Event): this {
        this.getImpl().event = event
        return this
    }

    public same(same: boolean): this {
        this.getImpl().same = same
        return this
    }

    public element(element: HTMLCanvasElement): this {
        this.getImpl().element = element
        return this
    }

    protected get daa(): readonly string[] {
        return StartCellEventBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'from',
        'cell',
        'element',
        'same',
    ]
}

export function isStartCellEvent(value: unknown): value is StartCellEvent {
    return value instanceof StartCellEventImpl
}

export function assertIsStartCellEvent(
    value: unknown
): asserts value is StartCellEvent {
    if (!(value instanceof StartCellEventImpl))
        throw Error('Not a StartCellEvent!')
}
