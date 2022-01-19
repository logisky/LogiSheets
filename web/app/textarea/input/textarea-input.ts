// tslint:disable: limit-indent-for-method-in-class
import {TextAreaWrapper} from './textarea-wrapper'
import {TextAreaInputHost} from './textarea-input-host'
import {Subscription} from 'rxjs'
import {
    EventType,
    on,
    StandardKeyboardEvent,
    CompositionStartEventBuilder,
    canUseTextData,
    getClipboardData,
    ClipboardMetaDataBuilder,
    MIMES,
    ClipboardStoredMetaDataBuilder,
    setDataToCopy,
} from '@logi-sheets/web/core/events'
import {KeyboardEventCode, KeyCodeId} from '@logi-base/src/ts/common/key_code'
import {TextAreaState, TextAreaStateBuilder} from './textarea-state'
import {
    isChrome,
    isFirefox,
    isMac,
    isSafari,
} from '@logi-sheets/web/global/platform'
import {TypeData, TypeDataBuilder} from './type_data'
import {SelectionBuilder} from './selection'
import {PositionBuilder} from './position'
import {TextAreaInputEvents} from './textarea-input-events'
import {isHighSurrogate} from '@logi-sheets/web/core/strings'
import {debugWeb} from '@logi-sheets/web/global'
const enum ReadFromTextArea {
    TYPE,
    PASTE,
}
export class TextAreaInput extends TextAreaInputEvents {
    constructor(
        public readonly host: TextAreaInputHost,
        public readonly textarea: HTMLTextAreaElement,
    ) {
        super()
        this.writeScreenReaderContent()
        this._listen()
    }
    destroy(): void {
        this._subs.unsubscribe()
        this._selectionChangeListener?.unsubscribe()
    }

    hasFocus(): boolean {
        return this._hasFocus
    }

    focusTextArea(): void {
        this._setHasFocus(true)
        // this.refreshFocusState()
    }

    writeScreenReaderContent(): void {
        if (this._isDoingComposition)
            return
        this._setAndWriteTextAreaState(
            this.host.getScreenReaderContent(this._textAreaState)
        )
    }
    private _textAreaState = TextAreaStateBuilder.EMPTY
    private _textareaWrapper = new TextAreaWrapper(this.textarea)
    private _selectionChangeListener?: Subscription
    private _nextCommand = ReadFromTextArea.TYPE
    private _hasFocus = false
    private _isDoingComposition = false
    private _subs = new Subscription()
    // tslint:disable-next-line: max-func-body-length
    private _listen(): void {
        let lastKeyDown: StandardKeyboardEvent | null = null
        this._subs.add(on(this.textarea, EventType.KEY_DOWN).subscribe(e => {
            if (e.keyCode === KeyCodeId.KEY_IN_COMPOSITION
                || this._isDoingComposition && e.keyCode === KeyCodeId.BACKSPACE)
                e.stopPropagation()
            if (e.keyCode === KeyCodeId.ESCAPE)
                e.preventDefault()
            lastKeyDown = new StandardKeyboardEvent(e)
            this.onKeyDown$.next(lastKeyDown)
        }))
        this._subs.add(on(this.textarea, EventType.KEY_UP).subscribe(e => {
            this.onKeyUp$.next(e)
        }))
        this._subs
            .add(on(this.textarea, EventType.COMPOSITION_START).subscribe(e => {
                if (this._isDoingComposition)
                    return
                this._isDoingComposition = true
                if (isMac()
                    && this._textAreaState.selectionStart === this._textAreaState.selectionEnd
                    && this._textAreaState.selectionStart > 0
                    && this._textAreaState.value.substr(
                        this._textAreaState.selectionStart - 1,
                        1
                    ) === e.data) {
                    const isArrowKey = lastKeyDown
                        && lastKeyDown.equals(KeyCodeId.KEY_IN_COMPOSITION)
                        && (lastKeyDown.e.code === KeyboardEventCode.ARROW_RIGHT || lastKeyDown.e.code === KeyboardEventCode.ARROW_LEFT)
                    if (isArrowKey || isFirefox()) {
                        const newState = new TextAreaStateBuilder(this._textAreaState)
                            .selectionStart(this._textAreaState.selectionStart - 1)
                            .selectionStartPosition(
                                this._textAreaState.selectionStartPosition ? new PositionBuilder(this._textAreaState.selectionStartPosition)
                                    .column(
                                        this._textAreaState.selectionStartPosition.column - 1
                                    )
                                    .build() : undefined
                            )
                            .build()
                        this._textAreaState = newState
                        this.onCompositionStart$.next(
                            new CompositionStartEventBuilder()
                                .revealDeltaColumns(-1)
                                .build()
                        )
                        return
                    }
                }
                this._setAndWriteTextAreaState(TextAreaStateBuilder.EMPTY)
                this.onCompositionStart$.next(new CompositionStartEventBuilder()
                    .revealDeltaColumns(0)
                    .build())
            }))
        const deduceComposition = (text: string): [TextAreaState, TypeData] => {
            const oldState = this._textAreaState
            const newState = TextAreaStateBuilder.selectedText(text)
            const typeInput = new TypeDataBuilder()
                .text(newState.value)
                .replacePrevCharCnt(
                    oldState.selectionEnd - oldState.selectionStart
                )
                .replaceNextCharCnt(0)
                .positionDelta(0)
                .build()
            return [newState, typeInput]
        }
        this._subs.add(
            on(this.textarea, EventType.COMPOSITION_UPDATE).subscribe(e => {
                const [newState, typeInput] = deduceComposition(e.data || '')
                this._textAreaState = newState
                this.onType$.next(typeInput)
                this.onCompositionUpdate$.next(e)
            })
        )
        this._subs
            .add(on(this.textarea, EventType.COMPOSITION_END).subscribe(e => {
                if (!this._isDoingComposition)
                    return
                this._isDoingComposition = false
                const [newState, typeInput] = deduceComposition(e.data || '')
                this._textAreaState = newState
                this.onType$.next(typeInput)
                if (isChrome() || isFirefox())
                    this._textAreaState = TextAreaStateBuilder
                        .readFromTextArea(this._textareaWrapper)
                this.onCompositionEnd$.next()
            }))
        const deduceInputFromTextAreaValue = (
            couldBeEmojiInput: boolean
        ): [TextAreaState, TypeData] => {
            const oldState = this._textAreaState
            const newState = TextAreaStateBuilder
                .readFromTextArea(this._textareaWrapper)
            return [newState, TextAreaStateBuilder
                .deduceInput(oldState, newState, couldBeEmojiInput)]
        }
        this._subs.add(on(this.textarea, EventType.INPUT).subscribe(() => {
            if (this._isDoingComposition)
                return
            const [newState, typeInput] = deduceInputFromTextAreaValue(isMac())
            if (typeInput.replacePrevCharCnt === 0
                && typeInput.text.length === 1
                && isHighSurrogate(typeInput.text.charCodeAt(0))
            )
                return
            this._textAreaState = newState
            if (this._nextCommand === ReadFromTextArea.TYPE) {
                if (typeInput.text !== '' || typeInput.replacePrevCharCnt !== 0)
                    this.onType$.next(typeInput)
            } else {
                if (typeInput.text !== '' || typeInput.replacePrevCharCnt !== 0) {
                    const metaData = new ClipboardMetaDataBuilder()
                        .text(typeInput.text)
                        .format(MIMES['.txt'])
                        .build()
                    const data = new ClipboardStoredMetaDataBuilder()
                        .clipboardMetaData([metaData])
                        .build()
                    this.onPaste$.next(data)
                }
                this._nextCommand = ReadFromTextArea.TYPE
            }
        }))
        this._subs.add(on(this.textarea, EventType.CUT).subscribe(e => {
            this._textareaWrapper.setIgnoreSelectionChangeTime()
            this._ensureClipboardGetsEditorSelection(e)
        }))
        this._subs.add(on(this.textarea, EventType.COPY).subscribe(e => {
            this._ensureClipboardGetsEditorSelection(e)
        }))
        this._subs.add(on(this.textarea, EventType.PASTE).subscribe(e => {
            if (canUseTextData(e)) {
                const data = getClipboardData(e)
                this.onPaste$.next(data)
            } else {
                if (this._textareaWrapper.getSelectionStart()
                    !== this._textareaWrapper.getSelectionEnd())
                    this._setAndWriteTextAreaState(TextAreaStateBuilder.EMPTY)
                this._nextCommand = ReadFromTextArea.PASTE
            }
        }))
        this._subs.add(on(this.textarea, EventType.FOCUS).subscribe(e => {
            e.stopPropagation()
            e.preventDefault()
            const hasFocus = this._hasFocus
            this._setHasFocus(true)
            if (isSafari() && !hasFocus && this._hasFocus)
                debugWeb('safari todo')
        }))
        this._subs.add(on(this.textarea, EventType.BLUR).subscribe(() => {
            if (this._isDoingComposition) {
                this._isDoingComposition = false
                this.writeScreenReaderContent()
                this.onCompositionEnd$.next()
            }
            this._setHasFocus(false)
        }))
    }

    private _setHasFocus(hasFocus: boolean): void {
        if (this._hasFocus === hasFocus)
            return
        this._hasFocus = hasFocus
        if (this._selectionChangeListener) {
            this._selectionChangeListener.unsubscribe()
            this._selectionChangeListener = undefined
        }
        if (this._hasFocus) {
            this.writeScreenReaderContent()
            this._installSelectionChangeListener()
            this.onFocus$.next()
        } else
            this.onBlur$.next()
    }

    private _ensureClipboardGetsEditorSelection(e: ClipboardEvent): void {
        const start = this._textAreaState.selectionStartPosition
        const end = this._textAreaState.selectionEndPosition
        if (!start || !end)
            return
        const dataToCopy = this.host.getDataToCopy(start, end)
        if (!canUseTextData(e)) {
            this._setAndWriteTextAreaState(
                TextAreaStateBuilder.selectedText(dataToCopy.text)
            )
            return
        }
        setDataToCopy(dataToCopy.data, e)
    }

    // tslint:disable-next-line: max-func-body-length
    private _installSelectionChangeListener(): void {
        let previoursSelectionChangeEventTime = 0
        this._selectionChangeListener = on(document, EventType.SELECTION_CHANGE)
            .subscribe(() => {
                if (!this._hasFocus || this._isDoingComposition || !isChrome())
                    return
                const now = Date.now()
                const delta1 = now - previoursSelectionChangeEventTime
                previoursSelectionChangeEventTime = now
                if (delta1 < 5)
                    return
                const delta2 = now - this._textareaWrapper
                    .getIgnoreSelectionChangeTime()
                this._textareaWrapper.resetSelectionChangeTime()
                if (delta2 < 100)
                    return
                if (!this._textAreaState.selectionStartPosition || !this._textAreaState.selectionEndPosition)
                    return
                const newValue = this._textareaWrapper.getValue()
                if (this._textAreaState.value !== newValue)
                    return
                const newSelectionStart = this._textareaWrapper
                    .getSelectionStart()
                const newSelectionEnd = this._textareaWrapper.getSelectionEnd()
                if (newSelectionStart === this._textAreaState.selectionStart && newSelectionEnd === this._textAreaState.selectionEnd)
                    return
                const newStartPosition = this._textAreaState
                    .deduceEditorPosition(newSelectionStart)
                const newSelectionStartPosition = this.host.deduceModelPosition(
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    newStartPosition[0]!,
                    newStartPosition[1],
                    newStartPosition[2]
                )
                const newEndPosition = this._textAreaState
                    .deduceEditorPosition(newSelectionEnd)
                const newSelectionEndPosition = this.host.deduceModelPosition(
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    newEndPosition[0]!,
                    newEndPosition[1],
                    newEndPosition[2]
                )
                const newSelection = new SelectionBuilder()
                    .selectionStartLineNumber(
                        newSelectionStartPosition.lineNumber
                    )
                    .selectionStartColumn(newSelectionStartPosition.column)
                    .positionLineNumber(newSelectionEndPosition.lineNumber)
                    .positionColumn(newSelectionEndPosition.column)
                    .build()
                this.onSelectionChange$.next(newSelection)
            })
    }

    private _setAndWriteTextAreaState(textAreaState: TextAreaState): void {
        let state = textAreaState
        if (!this._hasFocus)
            state = textAreaState.collapseSelection()
        state.writeToTextArea(this._textareaWrapper, this._hasFocus)
        this._textAreaState = state
    }
}
