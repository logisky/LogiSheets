import {Builder} from '@logi-base/src/ts/common/builder'
import {Position} from './position'
import {ClipboardStoredMetaData} from '@logi-sheets/web/core/events'
import {TextAreaState} from './textarea-state'
export interface ClipboardDataToCopy {
    readonly text: string
    readonly data: ClipboardStoredMetaData
}

class ClipboardDataToCopyImpl implements ClipboardDataToCopy {
    public text!: string
    public data!: ClipboardStoredMetaData
}

export class ClipboardDataToCopyBuilder extends Builder<ClipboardDataToCopy, ClipboardDataToCopyImpl> {
    public constructor(obj?: Readonly<ClipboardDataToCopy>) {
        const impl = new ClipboardDataToCopyImpl()
        if (obj)
            ClipboardDataToCopyBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public text(text: string): this {
        this.getImpl().text = text
        return this
    }

    public data(data: ClipboardStoredMetaData): this {
        this.getImpl().data = data
        return this
    }

    protected get daa(): readonly string[] {
        return ClipboardDataToCopyBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'text',
        'data',
    ]
}

export function isClipboardDataToCopy(
    value: unknown
): value is ClipboardDataToCopy {
    return value instanceof ClipboardDataToCopyImpl
}

export function assertIsClipboardDataToCopy(
    value: unknown
): asserts value is ClipboardDataToCopy {
    if (!(value instanceof ClipboardDataToCopyImpl))
        throw Error('Not a ClipboardDataToCopy!')
}

export interface TextAreaInputHost {
    getDataToCopy(start: Position, end: Position): ClipboardDataToCopy
    getScreenReaderContent(currentState: TextAreaState): TextAreaState
    deduceModelPosition(
        viewAnchorPosition: Position,
        deltaOffset: number,
        lineFeedCnt: number
    ): Position
}
