import {
    Component,
    InjectionToken,
    ChangeDetectionStrategy,
    Inject,
} from '@angular/core'
import {ContextMenuItem} from './context-menu-item'
import {ContextMenuService} from './service'

export const CONTEXT_MENU_DATA = new InjectionToken('context-menu-data')

@Component({
    selector: 'logi-context-menu',
    templateUrl: './context-menu.component.html',
    styleUrls: ['./context-menu.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContextMenuComponent {
    constructor(
        @Inject(CONTEXT_MENU_DATA)
        public readonly items: readonly ContextMenuItem[],
        private readonly _contextmenuSvc: ContextMenuService,
    ) { }
    clickItem(item: ContextMenuItem): void {
        item.click()
        this._contextmenuSvc.closePanel()
    }
}
