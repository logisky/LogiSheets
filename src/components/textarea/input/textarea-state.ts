import {
    commonPrefixLength,
    commonSuffixLength,
    containsEmoji,
    containsFullWidthCharactor,
} from 'global/strings'
import {Position} from './position'
import {TextAreaWrapper} from './textarea-wrapper'
import {TypeData} from './type_data'
export class TextAreaState {
    public value = ''
    public selectionStart = 0
    public selectionEnd = 0
    public selectionStartPosition?: Position
    public selectionEndPosition?: Position
    static readonly EMPTY = new TextAreaState()
    static readFromTextArea(textArea: TextAreaWrapper) {
        const state = new TextAreaState()
        state.value = textArea.getValue()
        state.selectionStart = textArea.getSelectionStart()
        state.selectionEnd = textArea.getSelectionEnd()
        return state
    }

    static selectedText(text: string) {
        const state = new TextAreaState()
        state.value = text
        state.selectionEnd = text.length
        return state
    }

    static deduceInput(
        previousState: TextAreaState,
        currentState: TextAreaState,
        couldBeEmojiInput: boolean,
    ) {
        if (!previousState)
            return new TypeData()
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
                ))) {
                    const typeData = new TypeData()
                    typeData.text = potentialEmojiInput
                    return typeData
                }
        }
        if (currSelectionStart === currSelectionEnd) {
            if (
                prevValue === currValue
                && prevSelectionStart === 0
                && prevSelectionEnd === prevValue.length
                && currSelectionStart === currValue.length
                && currValue.indexOf('\n') === -1
            ) {
                if (containsFullWidthCharactor(currValue))
                    return new TypeData()
            }
            else {
                const typeData = new TypeData()
                typeData.text = currValue
                typeData.replacePrevCharCnt = prevPrefix.length - prefixLength
                return typeData
            }
        }
        const replacePrevCharacters = prevSelectionEnd - prevSelectionStart
        const typeData = new TypeData()
        typeData.text = currValue
        typeData.replacePrevCharCnt = replacePrevCharacters
        return typeData
    }

    collapseSelection(): TextAreaState {
        const state = new TextAreaState()
        state.value = this.value
        state.selectionStart = this.value.length
        state.selectionEnd = this.value.length
        return state
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

export class PagedScreenReaderStrategy {
    static fromEditorSelection(previousState: TextAreaState) {
        return TextAreaState.EMPTY
    }
}
