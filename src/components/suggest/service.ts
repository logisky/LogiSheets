/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// tslint:disable: unknown-instead-of-any
import {
    FlexibleConnectedPositionStrategy,
    Overlay,
    OverlayConfig,
    OverlayRef,
} from '@angular/cdk/overlay'
import {ComponentPortal, PortalInjector} from '@angular/cdk/portal'
import {
    ComponentRef,
    ElementRef,
    Injectable,
    InjectionToken,
    Injector,
    OnDestroy,
} from '@angular/core'
import {Observable, Subject} from 'rxjs'
import {SuggestDirective} from './suggest.directive'

import {
    SuggestTriggerComponent,
    FORMULA_SELECTION_DATA,
} from './suggest-trigger'
import {
    SuggestItem,
    SuggestItemBuilder,
    SpanItem,
    SpanItemBuilder,
} from './item'
import {lcsLenMatch} from './lcs'
import {FORMULAS} from '@logi-sheets/web/core/formula'

@Injectable()
export class SuggestService implements OnDestroy {
    public constructor(
        private readonly _overlay: Overlay,
        private readonly _injector: Injector,
    ) {}
    get optionSelect$(): Observable<string> {
        return this._optionSelect$
    }

    optionSelect(item: SuggestItem): void {
        this._optionSelect$.next(item.getString())
    }

    public ngOnDestroy(): void {
        this._destroyPanel()
    }

    public openPanel(triggerText: string, suggestHost: SuggestDirective): void {
        const items = this._filter(triggerText)
        if (items.length === 0) {
            this.closePanel()
            return
        }
        this._fakeElement = {
            getBoundingClientRect: () => {
                return {
                    height: 0,
                    width: 0,
                    left: suggestHost.suggestX,
                    right: suggestHost.suggestX,
                    top: suggestHost.suggestY,
                    bootom: suggestHost.suggestY,
                }
            },
        }
        if (!this._overlayRef)
            this._overlayRef = this._createOverlayRef()
        else {
            this._positionStrategy?.setOrigin(this._fakeElement)
            this._overlayRef.updateSize({width: suggestHost.suggestWidth})
        }
        if (this._overlayRef && !this._overlayRef.hasAttached()) {
            const tokens = new WeakMap<InjectionToken<string>, readonly SuggestItem[]>([
                [FORMULA_SELECTION_DATA, items],
            ])
            const injector = new PortalInjector(this._injector, tokens)
            const portal
                = new ComponentPortal(SuggestTriggerComponent, undefined, injector)
            this._componentRef = this._overlayRef.attach(portal)
            this._componentRef.changeDetectorRef.detectChanges()
        }
    }

    public closePanel(): void {
        this._overlayRef?.detach()
    }
    private _optionSelect$ = new Subject<string>()
    private _overlayRef?: OverlayRef | null
    private _componentRef?: ComponentRef<SuggestTriggerComponent>
    private _positionStrategy?: FlexibleConnectedPositionStrategy
    private _fakeElement: any = {
        // tslint:disable-next-line:ter-arrow-body-style
        getBoundingClientRect: () => ({
            bottom: 0,
            height: 0,
            left: 0,
            right: 0,
            top: 0,
            width: 0,
        }),
    }
    private _filter(triggerText: string): readonly SuggestItem[] {
        const allItems = FORMULAS.map(f => f.name)
        const infos = lcsLenMatch(triggerText, allItems, true)
        return infos.map(info => {
            const descItemIndex = allItems.indexOf(info[0])
            let desc = ''
            if (descItemIndex !== -1)
                desc = FORMULAS[descItemIndex].desc
            const spans: SpanItem[] = []
            let spanText = ''
            let isHighlight = false
            const highlightIndexes = Array.from(info[1].values())
            info[0].split('').forEach((t, i) => {
                if (spanText === '') {
                    spanText = t
                    isHighlight = highlightIndexes.indexOf(i) !== -1
                    return
                }
                const highlight = highlightIndexes.indexOf(i) !== -1
                if (highlight === isHighlight) {
                    spanText += t
                    return
                }
                spans.push(new SpanItemBuilder()
                    .text(spanText)
                    .highlight(isHighlight)
                    .build())
                spanText = ''
            })
            if (spanText !== '')
                spans.push(new SpanItemBuilder()
                    .text(spanText)
                    .highlight(isHighlight)
                    .build())
            return new SuggestItemBuilder()
                .triggerText(triggerText)
                .desc(desc)
                .suggestFullText(info[0])
                .spans(spans)
                .build()
        })
    }

    private _createOverlayRef(): OverlayRef {
        const config = new OverlayConfig()
        const el = new ElementRef(this._fakeElement)
        this._positionStrategy = config.positionStrategy = this._overlay
            .position()
            .flexibleConnectedTo(el)
            .withPositions([
                {
                    originX: 'start',
                    originY: 'bottom',
                    overlayX: 'start',
                    overlayY: 'top',
                },
                {
                    originX: 'start',
                    originY: 'top',
                    overlayX: 'start',
                    overlayY: 'bottom',
                },
            ])
        config.scrollStrategy = this._overlay.scrollStrategies.reposition()
        return this._overlay.create(config)
    }

    private _destroyPanel(): void {
        if (this._overlayRef) {
            this.closePanel()
            this._overlayRef.dispose()
            // tslint:disable-next-line: no-null-keyword
            this._overlayRef = null
        }
    }
}
