import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    OnInit,
} from '@angular/core'
import {DomSanitizer} from '@angular/platform-browser'

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'logi-copy-paste',
    styleUrls: ['./copy-paste.component.scss'],
    templateUrl: './copy-paste.component.html',
})
export class CopyPasteComponent implements OnInit {

    public constructor(
        private readonly _domSanitizer: DomSanitizer,
        private readonly _host: ElementRef<HTMLElement>,
        private readonly _cd: ChangeDetectorRef,
    ) { }
    public imgUrl = ''

    public ngOnInit(): void {
        this._host.nativeElement.addEventListener('paste', e => {
            e.stopPropagation()
            e.preventDefault()
            console.log(e)
            console.log(e.clipboardData?.getData('text/plain'))
            console.log(e.clipboardData?.getData('image/png'))
            console.log(e.clipboardData?.files[0])
            this.imgUrl = this._domSanitizer.bypassSecurityTrustUrl(
                URL.createObjectURL(e.clipboardData?.files[0]),
            ) as string
            // this.imgUrl = URL.createObjectURL(e.clipboardData?.files[0])
            // navigator.clipboard
            //     .readText()
            //     .then(text => console.log(text))
            //     .catch(err => console.log('err', err))
            this._cd.detectChanges()
        })
    }

}
