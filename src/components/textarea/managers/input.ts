import { Context, Text } from '../defs'
import {
    ClipboardMetaData,
    ClipboardStoredMetaData,
    KeyboardEventCode,
    MIMES,
} from '@/common/events'
import { TextManager } from './text'
import {
    Position,
    ClipboardDataToCopy,
    TextAreaInput,
    TextAreaInputHost,
    TextAreaState,
    PagedScreenReaderStrategy,
} from '../input'
import { useCursor } from './cursor'
import { useSelection } from './selection'
import { AccessibilitySupport } from '@/common/document'
import { isMac } from '@/common/platform'
import { Subscription, Subject, Observable } from 'rxjs'

export class InputManager<T> extends Subscription {
    constructor(
        private readonly _textManager: TextManager<T>,
        private readonly _selectionManager: ReturnType<typeof useSelection>,
        private readonly _context: Context<T>,
        private readonly _cursorManager: ReturnType<typeof useCursor>,
    ) {
        super()
    }
    get textareaInput() {
        return this._textareaInput
    }
    hasFocus(): boolean {
        return this._textareaInput?.hasFocus() ?? false
    }
    setFocus() {
        this._textareaInput?.focusTextArea()
        this._cursorManager.focus()
    }

    init(textarea: HTMLTextAreaElement) {
        this._textareaInput?.destroy()
        const textAreaInputHost: TextAreaInputHost = {
            getDataToCopy: (
                start: Position,
                end: Position
            ) => {
                const texts = this._context.getTexts(start, end)
                const d = new ClipboardMetaData()
                d.format = MIMES['.txt']
                d.text = texts.join(this._context.eof)
                const data = new ClipboardStoredMetaData([d])
                return new ClipboardDataToCopy(data)
            },
            getScreenReaderContent: (
                currentState: TextAreaState
            ) => {
                if (this._accessibilitySupport === AccessibilitySupport.DISABLED) {
                    if (isMac())
                        console.log('TODO', 'mac process')
                    return TextAreaState.EMPTY
                }
                return PagedScreenReaderStrategy
                    .fromEditorSelection(currentState)
            },
            deduceModelPosition: (
                viewAnchorPosition: Position,
                deltaOffset: number,
                lineFeedCnt: number
            ) => {
                console.log('TODO', viewAnchorPosition, deltaOffset, lineFeedCnt)
                return viewAnchorPosition
            },
        }
        this._textareaInput = new TextAreaInput(textAreaInputHost, textarea)
        this._listen()
    }

    get blur$(): Observable<void> {
        return this._blur$
    }
    private _blur$ = new Subject<undefined>()
    private _textareaInput?: TextAreaInput
    private _accessibilitySupport = AccessibilitySupport.DISABLED
    private get _cursor() {
        return this._cursorManager.currCursor.current
    }

    private _listen(): void {
        const input = this._textareaInput
        if (input === undefined)
            return
        // this.add(this._textManager.textChanged$.subscribe(() => {
        //     input.writeScreenReaderContent()
        // }))
        this.add(input.onBlur$.subscribe(() => {
            this._blur$.next(undefined)
            this._cursorManager.blur()
        }))
        this.add(input.onFocus$.subscribe(() => {
            if (this.hasFocus())
                return
            this._cursorManager.focus()
        }))
        this.add(input.onType$.subscribe(e => {
            const cursor = this._cursor

            const selection = this._selectionManager.getSelection()
            let added: readonly Text[] = []
            let removed: readonly Text[] = []
            if (selection !== undefined) {
                removed = this._textManager.remove(
                    selection.startLineNumber,
                    selection.startColumn,
                    selection.endLineNumber,
                    selection.endColumn
                )
                this._cursorManager.type([], removed)
            }
            if (e.positionDelta || e.replaceNextCharCnt || e.replacePrevCharCnt)
                console.log('textarea type composition change', e)
            else {
                const line = cursor.lineNumber
                const col = cursor.column
                added = this._textManager.add(e.text, line, col)
                this._cursorManager.type(added, [])
            }
            input.writeScreenReaderContent()
            this._selectionManager.type()
        }))
        this.add(input.onKeyDown$.subscribe(e => {
            if (e.keyCodeId === KeyboardEventCode.BACKSPACE) {
                const cursor = this._cursor
                if (cursor.lineNumber === 0 && cursor.column === 0)
                    return
                const selection = this._selectionManager.getSelection()
                const removed: Text[] = []
                if (selection !== undefined)
                    removed.push(...this._textManager.remove(
                        selection.startLineNumber,
                        selection.startColumn,
                        selection.endLineNumber,
                        selection.endColumn,
                    ))
                else
                    removed.push(...this._textManager.remove(
                        cursor.lineNumber,
                        cursor.column - 1,
                        cursor.lineNumber,
                        cursor.column - 1,
                    ))
                this._cursorManager.type([], removed)
                this._selectionManager.keydown(e)
            } else if (e.keyCodeId === KeyboardEventCode.ENTER)
                this._blur$.next(undefined)
            else
                this._cursorManager.keydown(e)
        }))
        this.add(input.onPaste$.subscribe(e => {
            const text = e.clipboardMetaData[0]?.text
            if (text === undefined)
                return
            const { lineNumber, column } = this._cursor
            const added = this._textManager.add(text, lineNumber, column)
            this._cursorManager.type(added, [])
        }))
    }
}
