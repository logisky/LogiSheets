import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
} from '@angular/core'
import {DomSanitizer, SafeUrl} from '@angular/platform-browser'

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'logi-img-viewer',
    styleUrls: ['./img-viewer.component.scss'],
    templateUrl: './img-viewer.component.html',
})
export class ImgViewerComponent {
    public constructor(
        private readonly _domSnitizer: DomSanitizer,
        private readonly _cd: ChangeDetectorRef,
    ) {}
    public imgText = ''
    public imgUrl: SafeUrl = ''
    public onSet(): void {
        this.imgUrl = this._domSnitizer.bypassSecurityTrustUrl(this.imgText)
        this._cd.detectChanges()
    }
}
