import {Builder} from '@logi-base/src/ts/common/builder'
// tslint:disable: limit-indent-for-method-in-class
import {
    commonPrefixLength,
    commonSuffixLength,
    containsEmoji,
    containsFullWidthCharactor,
} from '@logi-sheets/web/core/strings'
import {Position} from './position'
import {TextAreaWrapper} from './textarea-wrapper'
import {TypeData, TypeDataBuilder} from './type_data'
export interface TextAreaState {
        readonly value: string,
        readonly selectionStart: number,
        readonly selectionEnd: number,
        readonly selectionStartPosition?: Position,
        readonly selectionEndPosition?: Position,
        collapseSelection(): TextAreaState
        writeToTextArea(textarea: TextAreaWrapper, focus: boolean): void
        deduceEditorPosition(
            offset: number
        ): readonly [Position | undefined, number, number]
}

class TextAreaStateImpl implements TextAreaState {
    public value = ''
    public selectionStart = 0
    public selectionEnd = 0
    public selectionStartPosition?: Position
    public selectionEndPosition?: Position
    // tslint:disable-next-line: no-unnecessary-method-declaration
    collapseSelection(): TextAreaState {
        return new TextAreaStateBuilder()
            .value(this.value)
            .selectionStart(this.value.length)
            .selectionEnd(this.value.length)
            .build()
    }

    writeToTextArea(textArea: TextAreaWrapper, focus: boolean): void {
        textArea.setValue(this.value)
        if (!focus)
            return
        textArea.setSelectionRange(this.selectionStart, this.selectionEnd)
    }

    deduceEditorPosition(
        offset: number
    ): readonly [Position | undefined, number, number] {
        if (offset <= this.selectionStart) {
            const str = this.value.substring(offset, this.selectionStart)
            return this._finishDeduceEditorPosition(
                this.selectionStartPosition,
                str,
                -1
            )
        }
        if (offset >= this.selectionEnd) {
            const str = this.value.substring(this.selectionEnd, offset)
            return this
                ._finishDeduceEditorPosition(this.selectionEndPosition, str, 1)
        }
        const str1 = this.value.substring(this.selectionStart, offset)
        if (str1.indexOf(String.fromCharCode(8230)) === -1)
            return this._finishDeduceEditorPosition(
                this.selectionStartPosition,
                str1,
                1
            )
        const str2 = this.value.substring(offset, this.selectionEnd)
        return this
            ._finishDeduceEditorPosition(this.selectionEndPosition, str2, -1)
    }

    private _finishDeduceEditorPosition(
        anchor: Position | undefined,
        deltaText: string,
        signum: number
    ): readonly [Position | undefined, number, number] {
        let lineFeedCnt = 0
        let lastLineFeedIndex = -1
        while ((lastLineFeedIndex = deltaText
            .indexOf('\n', lastLineFeedIndex + 1)) !== -1)
            lineFeedCnt += 1
        return [anchor, signum * deltaText.length, lineFeedCnt]
    }
}

export class TextAreaStateBuilder extends Builder<TextAreaState, TextAreaStateImpl> {
    public constructor(obj?: Readonly<TextAreaState>) {
        const impl = new TextAreaStateImpl()
        if (obj)
            TextAreaStateBuilder.shallowCopy(impl, obj)
        super(impl)
    }
    static readonly EMPTY = new TextAreaStateBuilder().build()
    static readFromTextArea(textArea: TextAreaWrapper): TextAreaState {
        return new TextAreaStateBuilder()
            .value(textArea.getValue())
            .selectionStart(textArea.getSelectionStart())
            .selectionEnd(textArea.getSelectionEnd())
            .build()
    }

    static selectedText(text: string): TextAreaState {
        return new TextAreaStateBuilder()
            .value(text)
            .selectionEnd(text.length)
            .build()
    }

    // tslint:disable-next-line: max-func-body-length
    static deduceInput(
        previousState: TextAreaState,
        currentState: TextAreaState,
        couldBeEmojiInput: boolean,
    ): TypeData {
        if (!previousState)
            return new TypeDataBuilder()
                .text('')
                .replaceNextCharCnt(0)
                .replacePrevCharCnt(0)
                .positionDelta(0)
                .build()
        let [
            prevValue,
            prevSelectionStart,
            prevSelectionEnd,
            currValue,
            currSelectionStart,
            currSelectionEnd,
        ] = [
            previousState.value,
            previousState.selectionStart,
            previousState.selectionEnd,
            currentState.value,
            currentState.selectionStart,
            currentState.selectionEnd,
        ]
        const prevSuffix = prevValue.substring(prevSelectionEnd)
        const currSuffix = currValue.substring(currSelectionEnd)
        const suffixLength = commonSuffixLength(prevSuffix, currSuffix)
        currValue = currValue.substring(0, currValue.length - suffixLength)
        prevValue = prevValue.substring(0, prevValue.length - suffixLength)

        const prevPrefix = prevValue.substring(0, prevSelectionStart)
        const currPrefix = currValue.substring(0, currSelectionStart)
        const prefixLength = commonPrefixLength(prevPrefix, currPrefix)
        currValue = currValue.substring(prefixLength)
        prevValue = prevValue.substring(prefixLength)
        currSelectionStart -= prefixLength
        prevSelectionStart -= prefixLength
        currSelectionEnd -= prefixLength
        prevSelectionEnd -= prefixLength
        if (couldBeEmojiInput && currSelectionStart === currSelectionEnd && prevValue.length > 0) {
            let potentialEmojiInput: string | null = null
            if (currSelectionStart === currValue.length) {
                if (currValue.startsWith(prevValue))
                    potentialEmojiInput = currValue.substring(prevValue.length)
            // tslint:disable-next-line: ext-curly
            } else if (currValue.endsWith(prevValue))
                potentialEmojiInput = currValue
                    .substring(0, currValue.length - prevValue.length)
            if (potentialEmojiInput !== null
                && potentialEmojiInput.length > 0
                && (/\uFE0F/.test(potentialEmojiInput) || containsEmoji(
                    potentialEmojiInput
                )))
                return new TypeDataBuilder()
                    .text(potentialEmojiInput)
                    .replacePrevCharCnt(0)
                    .replaceNextCharCnt(0)
                    .positionDelta(0)
                    .build()
        }
        // tslint:disable-next-line: ext-curly
        if (currSelectionStart === currSelectionEnd) {
            if (
                prevValue === currValue
                && prevSelectionStart === 0
                && prevSelectionEnd === prevValue.length
                && currSelectionStart === currValue.length
                && currValue.indexOf('\n') === -1
            ) {
                if (containsFullWidthCharactor(currValue))
                    return new TypeDataBuilder()
                        .text('')
                        .replacePrevCharCnt(0)
                        .replaceNextCharCnt(0)
                        .positionDelta(0)
                        .build()
            }
            else
                new TypeDataBuilder()
                    .text(currValue)
                    .replacePrevCharCnt(prevPrefix.length - prefixLength)
                    .replaceNextCharCnt(0)
                    .build()
        }
        const replacePrevCharacters = prevSelectionEnd - prevSelectionStart
        return new TypeDataBuilder()
            .text(currValue)
            .replacePrevCharCnt(replacePrevCharacters)
            .replaceNextCharCnt(0)
            .positionDelta(0)
            .build()
    }

    public value(value: string): this {
        this.getImpl().value = value
        return this
    }

    public selectionStart(selectionStart: number): this {
        this.getImpl().selectionStart = selectionStart
        return this
    }

    public selectionEnd(selectionEnd: number): this {
        this.getImpl().selectionEnd = selectionEnd
        return this
    }

    public selectionStartPosition(selectionStartPosition?: Position): this {
        this.getImpl().selectionStartPosition = selectionStartPosition
        return this
    }

    public selectionEndPosition(selectionEndPosition?: Position): this {
        this.getImpl().selectionEndPosition = selectionEndPosition
        return this
    }
}

export function isTextAreaState(value: unknown): value is TextAreaState {
    return value instanceof TextAreaStateImpl
}

export function assertIsTextAreaState(
    value: unknown
): asserts value is TextAreaState {
    if (!(value instanceof TextAreaStateImpl))
        throw Error('Not a TextAreaState!')
}

export class PagedScreenReaderStrategy {
    // @ts-expect-error TODO(minglong): support it
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static fromEditorSelection(previousState: TextAreaState): TextAreaState {
        return TextAreaStateBuilder.EMPTY
    }
}
