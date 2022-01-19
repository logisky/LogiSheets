import {
    Component,
    Input,
    Output,
    EventEmitter,
    ChangeDetectionStrategy,
} from '@angular/core'
import {SetAttrEvent} from './content'
import {SelectedCell} from '@logi-sheets/web/app/canvas'
import {MainMenuType} from './main-menu.component'

@Component({
    selector: 'logi-top-bar',
    templateUrl: './top-bar.component.html',
    styleUrls: ['./top-bar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopBarComponent {
    @Output() readonly setAttrEvent$ = new EventEmitter<SetAttrEvent>()
    @Input() selectedCell?: SelectedCell
    mainMenuType = MainMenuType.START
    mainMenuTypeEnum = MainMenuType
    mainMenuChange(type: MainMenuType): void {
        this.mainMenuType = type
    }
}
