import {Directive, Input, ElementRef, Output, OnDestroy} from '@angular/core'
import {SuggestService} from './service'

@Directive({selector: '[logi-suggest]'})
export class SuggestDirective implements OnDestroy {
    constructor(
        private readonly _host: ElementRef<HTMLElement>,
        private readonly _suggestSvc: SuggestService,
    ) {
    }
    @Input() readonly suggestX: number = 0
    @Input() readonly suggestY: number = 0
    @Input() readonly suggestHeight: number = 400
    @Input() readonly suggestWidth: number = 300
    @Input() set triggerText(triggerText: string) {
        this._suggestSvc.openPanel(triggerText, this)
    }

    @Input() set suggestClose(close: boolean) {
        if (!close)
            return
        this._suggestSvc.closePanel()
    }
    @Output() readonly suggestSelected$ = this._suggestSvc.optionSelect$
    get host(): HTMLElement {
        return this._host.nativeElement
    }

    ngOnDestroy(): void {
        this._suggestSvc.closePanel()
    }
}
