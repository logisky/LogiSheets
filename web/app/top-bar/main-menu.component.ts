import {Builder} from '@logi-base/src/ts/common/builder'
import {
    Input,
    Component,
    Output,
    EventEmitter,
    ChangeDetectionStrategy,
} from '@angular/core'

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'logi-main-menu',
    templateUrl: './main-menu.component.html',
    styleUrls: ['./main-menu.component.scss'],
})
export class MainMenuComponent {
    @Output() readonly mainMenuChanged$ = new EventEmitter<MainMenuType>()
    @Input() currType = MainMenuType.START
    mainMenuTypeEnum = MainMenuType
    btns = [
        new MainMenuBtnBuilder().text('开始').type(MainMenuType.START).build(),
    ] as const
    click(btn: MainMenuBtn): void {
        this.currType = btn.type
        this.mainMenuChanged$.next(btn.type)
    }
}
// tslint:disable-next-line: const-enum
export enum MainMenuType {
    START,
}
export interface MainMenuBtn {
    readonly text: string
    readonly type: MainMenuType
}

class MainMenuBtnImpl implements MainMenuBtn {
    public text!: string
    public type!: MainMenuType
}

export class MainMenuBtnBuilder extends Builder<MainMenuBtn, MainMenuBtnImpl> {
    public constructor(obj?: Readonly<MainMenuBtn>) {
        const impl = new MainMenuBtnImpl()
        if (obj)
            MainMenuBtnBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public text(text: string): this {
        this.getImpl().text = text
        return this
    }

    public type(type: MainMenuType): this {
        this.getImpl().type = type
        return this
    }

    protected get daa(): readonly string[] {
        return MainMenuBtnBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'text',
        'type',
    ]
}

export function isMainMenuBtn(value: unknown): value is MainMenuBtn {
    return value instanceof MainMenuBtnImpl
}

export function assertIsMainMenuBtn(
    value: unknown
): asserts value is MainMenuBtn {
    if (!(value instanceof MainMenuBtnImpl))
        throw Error('Not a MainMenuBtn!')
}
