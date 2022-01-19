import {ChangeDetectionStrategy, Component} from '@angular/core'

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'logi-app',
    styleUrls: ['./app.component.scss'],
    templateUrl: './app.component.html',
})
export class AppComponent {}
