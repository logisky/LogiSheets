import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {KeycodeComponent} from './keycode.component'

@NgModule({
    declarations: [
        KeycodeComponent,
    ],
    imports: [
        CommonModule,
    ],
    exports: [
        KeycodeComponent,
    ],
})
export class KeycodeModule { }
