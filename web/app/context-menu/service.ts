/* eslint-disable @typescript-eslint/no-explicit-any */
// tslint:disable: unknown-instead-of-any
import {
    FlexibleConnectedPositionStrategy,
    Overlay,
    OverlayConfig,
    OverlayRef,
} from '@angular/cdk/overlay'
import {ComponentPortal, PortalInjector} from '@angular/cdk/portal'
import {ViewportRuler} from '@angular/cdk/scrolling'
import {DOCUMENT} from '@angular/common'
import {
    ComponentRef,
    ElementRef,
    Inject,
    Injectable,
    InjectionToken,
    Injector,
    OnDestroy,
} from '@angular/core'
import {fromEvent, Subscription} from 'rxjs'
import {filter} from 'rxjs/operators'

import {ContextMenuComponent, CONTEXT_MENU_DATA} from './context-menu.component'
import {ContextMenuItem} from './context-menu-item'

/**
 * The width of suggestion panel, it should equal to css style `width`.
 */
const PANEL_WIDTH = 400

@Injectable()
export class ContextMenuService implements OnDestroy {
    public constructor(
        private readonly _overlay: Overlay,
        private readonly _injector: Injector,

        @Inject(DOCUMENT)
        private readonly _document: Document,
        private readonly _viewportRuler: ViewportRuler,
    ) {}

    public ngOnDestroy(): void {
        this._closingActionsSubs?.unsubscribe()
        this._viewportSubscription.unsubscribe()
        this._destroyPanel()
    }

    public openPanel(
        data: readonly ContextMenuItem[],
        mouseevent: MouseEvent,
    ): void {
        this.closePanel()
        this._fakeElement = {
            getBoundingClientRect: () => {
                return {
                    height: 0,
                    width: 0,
                    left: mouseevent.clientX,
                    right: mouseevent.clientX,
                    top: mouseevent.clientY,
                    bottom: mouseevent.clientY,
                }
            },
        }
        if (!this._overlayRef) {
            this._overlayRef = this._createOverlayRef()
            this._viewportSubscription = this._viewportRuler.change().subscribe(
                (): void => this._overlayRef?.updateSize({width: PANEL_WIDTH}),
            )
        } else {
            const el = new ElementRef(this._fakeElement)
            this._positionStrategy?.setOrigin(el)
            this._overlayRef.updateSize({width: PANEL_WIDTH})
        }

        if (this._overlayRef && !this._overlayRef.hasAttached()) {
            const tokens = new WeakMap<InjectionToken<string>, readonly ContextMenuItem[]>([
                [CONTEXT_MENU_DATA, data],
            ])
            const injector = new PortalInjector(this._injector, tokens)
            const portal
                = new ComponentPortal(ContextMenuComponent, undefined, injector)
            this._componentRef = this._overlayRef.attach(portal)
            this._componentRef.changeDetectorRef.detectChanges()
            this._closingActionsSubs = this._subscribeCloseActions()
        }
    }

    public closePanel(): void {
        this._overlayRef?.detach()
        this._closingActionsSubs?.unsubscribe()
    }
    private _overlayRef?: OverlayRef | null
    private _componentRef?: ComponentRef<ContextMenuComponent>
    private _closingActionsSubs?: Subscription
    private _viewportSubscription = Subscription.EMPTY
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

    private _createOverlayRef(): OverlayRef {
        const config = new OverlayConfig()
        config.hasBackdrop = false
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
        /**
         * Set scroll strategy to update overlay view when scrolling.
         * Reference from material autocomplete.
         * TODO (kai): Need to be optimized.
         */
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

    /**
     * Listen all click event from document and hide panel if event target is
     * not current connected element and not included in overlay element.
     */
    private _subscribeCloseActions(): Subscription {
        return fromEvent<MouseEvent>(this._document, 'click')
            .pipe(filter((e: MouseEvent): boolean => {
                // tslint:disable-next-line: no-type-assertion
                const target = e.target as HTMLElement
                return target !== this._fakeElement &&
                        // tslint:disable-next-line: no-double-negation
                        (!!this._overlayRef &&
                            !this._overlayRef.overlayElement.contains(target))
            }),)
            .subscribe((): void => this.closePanel())
    }
}
