import {NgModule} from '@angular/core'
import {CommonModule} from '@angular/common'
import {SuggestTriggerComponent} from './suggest-trigger'
import {SuggestDirective} from './suggest.directive'
import {SuggestService} from './service'

@NgModule({
    declarations: [
        SuggestDirective,
        SuggestTriggerComponent,
    ],
    imports: [
        CommonModule,
    ],
    exports: [
        SuggestDirective,
    ],
    providers: [SuggestService],
})
export class SuggestModule { }
