import {
    HostListener,
    Component,
    Input,
    Inject,
    ChangeDetectionStrategy,
    InjectionToken,
} from '@angular/core'
import {SuggestService} from './service'
import {SuggestItem} from './item'
import {StandardKeyboardEvent} from '@logi-sheets/web/core/events'
import {KeyCodeId} from '@logi-base/src/ts/common/key_code'
export const FORMULA_SELECTION_DATA = new InjectionToken('formula-selection-data')

@Component({
    selector: 'logi-suggest-trigger',
    templateUrl: './suggest-trigger.html',
    styleUrls: ['./suggest-trigger.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestTriggerComponent {
    constructor(
        private readonly _svc: SuggestService,
        @Inject(FORMULA_SELECTION_DATA)
        public readonly items: readonly SuggestItem[],
    ) {
    }
    @Input() width?: number
    get currItem(): SuggestItem | undefined {
        return this.items[this._currIndex]
    }

    @HostListener('keydown')
    handleKeydown(e: KeyboardEvent): void {
        const standardEvent = new StandardKeyboardEvent(e)
        if (standardEvent.keyCodeId === KeyCodeId.UPARROW) {
            this._currIndex = this._currIndex === 0 ? 0 : this._currIndex - 1
            return
        }
        if (standardEvent.keyCodeId === KeyCodeId.DOWNARROW) {
            const length = this.items.length - 1
            this._currIndex = this._currIndex === length ? length : this._currIndex + 1
            return
        }
        if (standardEvent.keyCodeId === KeyCodeId.ENTER) {
            if (this.currItem === undefined)
                return
            this._svc.optionSelect(this.currItem)
        }
    }

    handleOptionSelect(item: SuggestItem): void {
        this._svc.optionSelect(item)
    }
    private _currIndex = 0
}
