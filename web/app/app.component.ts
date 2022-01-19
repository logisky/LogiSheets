import {Component, ChangeDetectionStrategy} from '@angular/core'
// import init, {TransactionStartResult} from '../../wasm/pkg/logisheets_wasm'

@Component({
    selector: 'logi-app',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
    // constructor() {
    //     console.log(TransactionStartResult.Ok)
    //     init().then(e => {
    //         console.log(e)
    //     })
    // }
}
