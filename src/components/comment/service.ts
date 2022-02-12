/* eslint-disable @typescript-eslint/no-unused-vars */
import {Overlay, OverlayConfig, OverlayRef} from '@angular/cdk/overlay'
import {ComponentPortal, PortalInjector} from '@angular/cdk/portal'
import {
    ComponentRef,
    Injectable,
    InjectionToken,
    Injector,
    OnDestroy,
} from '@angular/core'
import {Comment} from '@logi-pb/network/src/proto/message_pb'

import {CommentComponent, LOGI_SHEETS_COMMENT_DATA} from './comment.component'
import {Position} from './position'

@Injectable()
export class CommentService implements OnDestroy {
    public constructor(
        private readonly _overlay: Overlay,
        private readonly _injector: Injector,
    ) {}
    public ngOnDestroy(): void {
        this.closePanel()
        this._overlayRef?.dispose()
        this._overlayRef = undefined
    }

    public openPanel(comment: Comment, position: Position): void {
        if (!this._overlayRef)
            this._overlayRef = this._createOverlayRef(position)
        if (this._overlayRef.hasAttached())
            this._overlayRef.detach()
        const tokens = new WeakMap<InjectionToken<string>, Comment>([
            [LOGI_SHEETS_COMMENT_DATA, comment],
        ])
        const injector = new PortalInjector(this._injector, tokens)
        const portal
            = new ComponentPortal(CommentComponent, undefined, injector)
        this._componentRef = this._overlayRef.attach(portal)
        this._componentRef.changeDetectorRef.detectChanges()
    }

    public closePanel(): void {
        this._overlayRef?.detach()
    }
    private _overlayRef?: OverlayRef
    private _componentRef?: ComponentRef<CommentComponent>
    private _createOverlayRef(position: Position): OverlayRef {
        const config = new OverlayConfig()
        config.minWidth = 300
        config.minHeight = 100
        config.positionStrategy = this._overlay
            .position()
            .global()
            .left(`${position.x}px`)
            .top(`${position.y}px`)
        config.scrollStrategy = this._overlay.scrollStrategies.reposition()
        return this._overlay.create(config)
    }
}
