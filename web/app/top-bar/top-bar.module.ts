import {CommonModule} from '@angular/common'
import {NgModule} from '@angular/core'
import {TopBarComponent} from './top-bar.component'
import {MainMenuComponent} from './main-menu.component'
import {ContentModule} from './content'

@NgModule({
    exports: [TopBarComponent],
    declarations: [
        MainMenuComponent,
        TopBarComponent,
    ],
    imports: [
        CommonModule,
        ContentModule,
    ],
})
export class TopBarModule { }
