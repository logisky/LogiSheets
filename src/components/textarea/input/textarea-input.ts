import {TextAreaWrapper} from './textarea-wrapper'
import {TextAreaInputHost} from './textarea-input-host'
import {Subscription} from 'rxjs'
import {
    EventType,
    on,
    StandardKeyboardEvent,
    canUseTextData,
    getClipboardData,
    MIMES,
    setDataToCopy,
    KeyboardEventCode,
    CompositionStartEvent,
    ClipboardMetaData,
    ClipboardStoredMetaData,
} from '@/core/events'
import {TextAreaState} from './textarea-state'
import {isChrome, isFirefox, isMac} from '@/core/platform'
import {TypeData} from './type_data'
import {Selection} from './selection'
import {Position} from './position'
import {TextAreaInputEvents} from './textarea-input-events'
import {isHighSurrogate} from '@/core/strings'
import {shallowCopy} from '@/core'
const enum ReadFromTextArea {
    TYPE,
    PASTE,
}
export class TextAreaInput extends TextAreaInputEvents {
    constructor(
        public readonly host: TextAreaInputHost,
        public readonly textarea: HTMLTextAreaElement
    ) {
        super()
        this._textareaWrapper = new TextAreaWrapper(this.textarea)
        this.writeScreenReaderContent()
    }
    destroy(): void {
        this._subs.unsubscribe()
        this._selectionChangeListener?.unsubscribe()
    }

    hasFocus(): boolean {
        return this._hasFocus
    }

    focusTextArea(): void {
        this.#setHasFocus(true)
        // this.refreshFocusState()
    }

    writeScreenReaderContent(): void {
        if (this._isDoingComposition) return
        this._setAndWriteTextAreaState(
            this.host.getScreenReaderContent(this._textAreaState)
        )
    }
    onKeydown(e: KeyboardEvent) {
        if (
            e.isComposing ||
            (this._isDoingComposition && e.code === KeyboardEventCode.BACKSPACE)
        )
            e.stopPropagation()
        if (e.code === KeyboardEventCode.ESCAPE) e.preventDefault()
        this._lastKeydown = new StandardKeyboardEvent(e)
        this.onKeyDown$.next(this._lastKeydown)
    }
    onKeyup(e: KeyboardEvent) {
        this.onKeyUp$.next(e)
    }
    onCompositionnStart(e: CompositionEvent) {
        if (this._isDoingComposition) return
        this._isDoingComposition = true
        if (
            isMac() &&
            this._textAreaState.selectionStart ===
                this._textAreaState.selectionEnd &&
            this._textAreaState.selectionStart > 0 &&
            this._textAreaState.value.substr(
                this._textAreaState.selectionStart - 1,
                1
            ) === e.data
        ) {
            const isArrowKey =
                this._lastKeydown &&
                this._lastKeydown.isComposing &&
                (this._lastKeydown.keyCodeId ===
                    KeyboardEventCode.ARROW_RIGHT ||
                    this._lastKeydown.keyCodeId ===
                        KeyboardEventCode.ARROW_LEFT)
            if (isArrowKey || isFirefox()) {
                const newState = new TextAreaState()
                shallowCopy(this._textAreaState, newState)
                newState.selectionStart = this._textAreaState.selectionStart - 1
                if (this._textAreaState.selectionStartPosition) {
                    const position = new Position()
                    shallowCopy(
                        this._textAreaState.selectionStartPosition,
                        position
                    )
                    position.column =
                        this._textAreaState.selectionStartPosition.column - 1
                    newState.selectionStartPosition = position
                }
                this._textAreaState = newState
                const compositionStartEvent = new CompositionStartEvent()
                compositionStartEvent.revealDeltaColumns = -1
                this.onCompositionStart$.next(compositionStartEvent)
                return
            }
        }
        this._setAndWriteTextAreaState(TextAreaState.EMPTY)
        this.onCompositionStart$.next(new CompositionStartEvent())
    }
    onCompositionUpdate(e: CompositionEvent) {
        const [newState, typeInput] = this.#deduceComposition(e.data || '')
        this._textAreaState = newState
        this.onType$.next(typeInput)
        this.onCompositionUpdate$.next(e)
    }
    onCompositionEnd(e: CompositionEvent) {
        if (!this._isDoingComposition) return
        this._isDoingComposition = false
        const [newState, typeInput] = this.#deduceComposition(e.data || '')
        this._textAreaState = newState
        this.onType$.next(typeInput)
        if (isChrome() || isFirefox())
            this._textAreaState = TextAreaState.readFromTextArea(
                this._textareaWrapper
            )
        this.onCompositionEnd$.next(undefined)
    }
    onInput() {
        if (this._isDoingComposition) return
        const [newState, typeInput] = this.#deduceInputFromTextAreaValue(
            isMac()
        )
        if (
            typeInput.replacePrevCharCnt === 0 &&
            typeInput.text.length === 1 &&
            isHighSurrogate(typeInput.text.charCodeAt(0))
        )
            return
        this._textAreaState = newState
        if (this._nextCommand === ReadFromTextArea.TYPE) {
            if (typeInput.text !== '' || typeInput.replacePrevCharCnt !== 0)
                this.onType$.next(typeInput)
        } else {
            if (typeInput.text !== '' || typeInput.replacePrevCharCnt !== 0) {
                const metaData = new ClipboardMetaData()
                metaData.text = typeInput.text
                metaData.format = MIMES['.txt']
                const clipboardStoredMetaData = new ClipboardStoredMetaData()
                clipboardStoredMetaData.clipboardMetaData = [metaData]
                this.onPaste$.next(clipboardStoredMetaData)
            }
            this._nextCommand = ReadFromTextArea.TYPE
        }
    }
    onCut(e: ClipboardEvent) {
        this._textareaWrapper.setIgnoreSelectionChangeTime()
        this._ensureClipboardGetsEditorSelection(e)
    }
    onCopy(e: ClipboardEvent) {
        this._ensureClipboardGetsEditorSelection(e)
    }
    onPaste(e: ClipboardEvent) {
        if (canUseTextData(e)) {
            const data = getClipboardData(e)
            this.onPaste$.next(data)
        } else {
            if (
                this._textareaWrapper.getSelectionStart() !==
                this._textareaWrapper.getSelectionEnd()
            )
                this._setAndWriteTextAreaState(TextAreaState.EMPTY)
            this._nextCommand = ReadFromTextArea.PASTE
        }
    }
    onFocus(e: FocusEvent) {
        e.stopPropagation()
        e.preventDefault()
        // const hasFocus = this._hasFocus
        this.#setHasFocus(true)
        // if (isSafari() && !hasFocus && this._hasFocus)
        //     console.log('safari todo')
    }
    onBlur() {
        if (this._isDoingComposition) {
            this._isDoingComposition = false
            this.writeScreenReaderContent()
            this.onCompositionEnd$.next(undefined)
        }
        this.#setHasFocus(false)
    }
    private _textAreaState = TextAreaState.EMPTY
    private _textareaWrapper: TextAreaWrapper
    private _selectionChangeListener?: Subscription
    private _nextCommand = ReadFromTextArea.TYPE
    private _hasFocus = false
    private _isDoingComposition = false
    private _subs = new Subscription()
    private _lastKeydown?: StandardKeyboardEvent
    #deduceComposition = (text: string) => {
        const oldState = this._textAreaState
        const newState = TextAreaState.selectedText(text)
        const typeInput = new TypeData()
        typeInput.text = newState.value
        typeInput.replacePrevCharCnt =
            oldState.selectionEnd - oldState.selectionStart
        return [newState, typeInput] as const
    }
    #deduceInputFromTextAreaValue = (couldBeEmojiInput: boolean) => {
        const oldState = this._textAreaState
        const newState = TextAreaState.readFromTextArea(this._textareaWrapper)
        return [
            newState,
            TextAreaState.deduceInput(oldState, newState, couldBeEmojiInput),
        ] as const
    }

    #setHasFocus(hasFocus: boolean): void {
        if (this._hasFocus === hasFocus) return
        this._hasFocus = hasFocus
        if (this._selectionChangeListener) {
            this._selectionChangeListener.unsubscribe()
            this._selectionChangeListener = undefined
        }
        if (this._hasFocus) {
            this.writeScreenReaderContent()
            this._installSelectionChangeListener()
            this.onFocus$.next(undefined)
        } else this.onBlur$.next(undefined)
    }

    private _ensureClipboardGetsEditorSelection(e: ClipboardEvent): void {
        const start = this._textAreaState.selectionStartPosition
        const end = this._textAreaState.selectionEndPosition
        if (!start || !end) return
        const dataToCopy = this.host.getDataToCopy(start, end)
        if (!canUseTextData(e)) {
            this._setAndWriteTextAreaState(
                TextAreaState.selectedText(dataToCopy.text)
            )
            return
        }
        setDataToCopy(dataToCopy.data, e)
    }

    // tslint:disable-next-line: max-func-body-length
    private _installSelectionChangeListener(): void {
        let previoursSelectionChangeEventTime = 0
        this._selectionChangeListener = on(
            document,
            EventType.SELECTION_CHANGE
        ).subscribe(() => {
            if (!this._hasFocus || this._isDoingComposition || !isChrome())
                return
            const now = Date.now()
            const delta1 = now - previoursSelectionChangeEventTime
            previoursSelectionChangeEventTime = now
            if (delta1 < 5) return
            const delta2 =
                now - this._textareaWrapper.getIgnoreSelectionChangeTime()
            this._textareaWrapper.resetSelectionChangeTime()
            if (delta2 < 100) return
            if (
                !this._textAreaState.selectionStartPosition ||
                !this._textAreaState.selectionEndPosition
            )
                return
            const newValue = this._textareaWrapper.getValue()
            if (this._textAreaState.value !== newValue) return
            const newSelectionStart = this._textareaWrapper.getSelectionStart()
            const newSelectionEnd = this._textareaWrapper.getSelectionEnd()
            if (
                newSelectionStart === this._textAreaState.selectionStart &&
                newSelectionEnd === this._textAreaState.selectionEnd
            )
                return
            const newStartPosition =
                this._textAreaState.deduceEditorPosition(newSelectionStart)
            const newSelectionStartPosition = this.host.deduceModelPosition(
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                newStartPosition[0]!,
                newStartPosition[1],
                newStartPosition[2]
            )
            const newEndPosition =
                this._textAreaState.deduceEditorPosition(newSelectionEnd)
            const newSelectionEndPosition = this.host.deduceModelPosition(
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                newEndPosition[0]!,
                newEndPosition[1],
                newEndPosition[2]
            )
            const newSelection = new Selection()
            newSelection.selectionStartLineNumber =
                newSelectionStartPosition.lineNumber
            newSelection.selectionStartColumn = newSelectionStartPosition.column
            newSelection.positionLineNumber = newSelectionEndPosition.lineNumber
            newSelection.positionColumn = newSelectionEndPosition.column
            this.onSelectionChange$.next(newSelection)
        })
    }

    private _setAndWriteTextAreaState(textAreaState: TextAreaState): void {
        let state = textAreaState
        if (!this._hasFocus) state = textAreaState.collapseSelection()
        state.writeToTextArea(this._textareaWrapper, this._hasFocus)
        this._textAreaState = state
    }
}
