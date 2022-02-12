import { Context, Text } from '../defs'
import {
    ClipboardMetaData,
    ClipboardStoredMetaData,
    KeyboardEventCode,
    MIMES,
    StandardKeyboardEvent,
} from 'global/events'
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
import { AccessibilitySupport } from 'global/document'
import { isMac } from 'global/platform'
import { ErrorNode, isErrorNode, parse } from 'core/formula'
import { debugWeb } from 'global'
import { Subscription, Subject, Observable } from 'rxjs'
import { tap } from 'rxjs/operators'

export class InputManager<T> extends Subscription {
    constructor(
        private readonly _textManager: TextManager<T>,
        private readonly _selectionManager: ReturnType<typeof useSelection>,
        private readonly _context: Context<T>,
        private readonly _cursorManager: ReturnType<typeof useCursor>,
    ) {
        super()
    }
    hasFocus(): boolean {
        return this._textareaInput?.hasFocus() ?? false
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
                        debugWeb('TODO', 'mac process')
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
                debugWeb('TODO', viewAnchorPosition, deltaOffset, lineFeedCnt)
                return viewAnchorPosition
            },
        }
        this._textareaInput = new TextAreaInput(textAreaInputHost, textarea)
        this._listen()
    }

    get focus$(): Observable<undefined> {
        return this._focus$
    }

    get blur$(): Observable<void> {
        return this._blur$
    }

    get type$() {
        return this._type$
    }

    get editingFunction$(): Observable<string> {
        return this._editingFunction$
    }

    get error$(): Observable<ErrorNode> {
        return this._error$
    }

    keydown$(): Observable<StandardKeyboardEvent> {
        return this._keydown$
    }
    private _error$ = new Subject<ErrorNode>()
    private _focus$ = new Subject<undefined>()
    private _blur$ = new Subject<undefined>()
    private _type$ =
        new Subject<readonly [add: readonly Text[], remove: readonly Text[]]>()
    private _keydown$ = new Subject<StandardKeyboardEvent>()
    private _editingFunction$ = new Subject<string>()
    private _textareaInput?: TextAreaInput
    private _accessibilitySupport = AccessibilitySupport.DISABLED
    private get _cursor() {
        return this._cursorManager.currCursor.current
    }
    private _check(text?: string) {
        const content = text === undefined ? this._textManager
            .getPlainText() : text
        return parse(content)
    }

    // private _setEdtingTexts(): void {
    //     const cursor = this._cursorManager.cursor
    //     const texts = this._textManager
    //         .getText(cursor.lineNumber, 0, cursor.lineNumber, cursor.column)
    //     let plainText = ''
    //     texts.forEach(t => plainText += t.char)
    //     const tokens = tokenize(plainText)
    //     if (tokens.length === 0)
    //         return
    //     const lastToken = tokens[tokens.length - 1]
    //     if (lastToken.type !== TokenType.FUNCTION)
    //         return
    //     // this._editingFunction$
    // }

    private _listen(): void {
        const input = this._textareaInput
        if (input === undefined)
            return
        // this.add(this._textManager.textChanged$.subscribe(() => {
        //     input.writeScreenReaderContent()
        // }))
        this.add(input.onBlur$.subscribe(() => {
            const n = this._check()
            if (isErrorNode(n)) {
                this._error$.next(n)
                input.focusTextArea()
                return
            }
            this._blur$.next(undefined)
            this._cursorManager.blur()
        }))
        this.add(input.onFocus$.subscribe(() => {
            this._focus$.next(undefined)
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
                debugWeb('textarea type composition change', e)
            else {
                const line = cursor.lineNumber
                const col = cursor.column
                added = this._textManager.add(e.text, line, col)
                this._cursorManager.type(added, [])
            }
            input.writeScreenReaderContent()
            // this._setEdtingTexts()
            this._selectionManager.type()
            this._type$.next([added, removed])
        }))
        this.add(input.onKeyDown$
            .pipe(tap(e => {
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
                    this._type$.next([[], removed])
                    this._cursorManager.type([], removed)
                    this._selectionManager.keydown(e)
                    return
                }
                if (e.keyCodeId === KeyboardEventCode.ENTER)
                    this._blur$.next(undefined)
            }))
            .subscribe(e => {
                this._keydown$.next(e)
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
