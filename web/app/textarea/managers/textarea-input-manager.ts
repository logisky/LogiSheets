// tslint:disable: max-params limit-indent-for-method-in-class
// tslint:disable: max-func-body-length
import {Context} from './context'
import {
    ClipboardMetaDataBuilder,
    MIMES,
    ClipboardStoredMetaDataBuilder,
    StandardKeyboardEvent,
} from '@logi-sheets/web/core/events'
import {TextManager} from './text-manager'
import {Text} from './texts'
import {
    Position,
    ClipboardDataToCopy,
    ClipboardDataToCopyBuilder,
    TextAreaInput,
    TextAreaInputHost,
    TextAreaState,
    TextAreaStateBuilder,
    PagedScreenReaderStrategy,
} from '@logi-sheets/web/app/textarea/input'
import {Subject, Observable, Subscription} from 'rxjs'
import {tap} from 'rxjs/operators'
import {CursorManager} from './cursor-manager'
import {SelectionManager} from './selection-manager'
import {KeyCodeId} from '@logi-base/src/ts/common/key_code'
import {AccessibilitySupport} from '@logi-sheets/web/core/document'
import {isMac} from '@logi-sheets/web/global/platform'
import {
    ErrorNode,
    formulaNode,
    isErrorNode,
    parse,
    tokenize,
    TokenType,
} from '@logi-sheets/web/core/formula'
import {debugWeb} from '@logi-sheets/web/global'

export class TextareaInputManager extends Subscription {
    constructor(
        // tslint:disable-next-line: parameter-properties
        private readonly _textManager: TextManager,
        private readonly _selectionManager: SelectionManager,
        private readonly _textarea: HTMLTextAreaElement,
        private readonly _context: Context,
        private readonly _cursorManager: CursorManager,
    ) {
        super()
        this.init()
    }
    replace(
        content: string,
        startLine: number,
        startColumn: number,
        endLine: number,
        endColumn: number
    ): void {
        this._textManager.replaceByTwoDimenSional(
            content,
            startLine,
            startColumn,
            endLine,
            endColumn
        )
    }

    hasFocus(): boolean {
        return this._textareaInput?.hasFocus() ?? false
    }

    init(): void {
        this._textareaInput?.destroy()
        const textAreaInputHost: TextAreaInputHost = {
            getDataToCopy: (
                start: Position,
                end: Position
            ): ClipboardDataToCopy => {
                const texts = this._context.getTexts(start, end)
                const d = new ClipboardMetaDataBuilder()
                    .format(MIMES['.txt'])
                    .text(texts.join(this._context.eof))
                    .build()
                const data = new ClipboardStoredMetaDataBuilder()
                    .clipboardMetaData([d])
                    .build()
                return new ClipboardDataToCopyBuilder()
                    .text('')
                    .data(data)
                    .build()
            },
            getScreenReaderContent: (
                currentState: TextAreaState
            ): TextAreaState => {
                if (this._accessibilitySupport === AccessibilitySupport.DISABLED) {
                    if (isMac())
                        debugWeb('TODO', 'mac process')
                    return TextAreaStateBuilder.EMPTY
                }
                return PagedScreenReaderStrategy
                    .fromEditorSelection(currentState)
            },
            deduceModelPosition: (
                viewAnchorPosition: Position,
                deltaOffset: number,
                lineFeedCnt: number
            ): Position => {
                debugWeb('TODO', viewAnchorPosition, deltaOffset, lineFeedCnt)
                return viewAnchorPosition
            },
        }
        this._textareaInput = new TextAreaInput(textAreaInputHost, this._textarea)
        this._listen()
    }

    get focus$(): Observable<undefined> {
        return this._focus$
    }

    get blur$(): Observable<void> {
        return this._blur$
    }

    get type$(): Observable<undefined> {
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
    private _type$ = new Subject<undefined>()
    private _keydown$ = new Subject<StandardKeyboardEvent>()
    private _editingFunction$ = new Subject<string>()
    private _textareaInput?: TextAreaInput
    private _accessibilitySupport = AccessibilitySupport.DISABLED
    private _check(text?: string): ErrorNode | formulaNode {
        const content = text === undefined ? this._textManager
            .getPlainText() : text
        return parse(content)
    }

    private _setEdtingTexts(): void {
        const cursor = this._cursorManager
        const texts = this._textManager
            .getText(cursor.lineNumber, 0, cursor.lineNumber, cursor.column)
        let plainText = ''
        texts.forEach(t => plainText += t.char)
        const tokens = tokenize(plainText)
        if (tokens.length === 0)
            return
        const lastToken = tokens[tokens.length - 1]
        if (lastToken.type !== TokenType.FUNCTION)
            return
        this._editingFunction$
    }

    private _listen(): void {
        const input = this._textareaInput
        if (input === undefined)
            return
        this.add(this._textManager.textChanged$.subscribe(() => {
            input.writeScreenReaderContent()
        }))
        this.add(input.onBlur$.subscribe(() => {
            const n = this._check()
            if (isErrorNode(n)) {
                this._error$.next(n)
                input.focusTextArea()
                return
            }
            this._blur$.next()
            this._cursorManager.blur()
        }))
        this.add(input.onFocus$.subscribe(() => {
            this._focus$.next()
            this._cursorManager.focus()
        }))
        // tslint:disable-next-line: max-func-body-length
        this.add(input.onType$.subscribe(e => {
            const cursor = this._cursorManager
            const selection = this._selectionManager.getSelection()
            if (selection !== undefined) {
                const removed = this._textManager.remove(
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
                const added = this._textManager.add(e.text, line, col)
                this._cursorManager.type(added, [])
            }
            input.writeScreenReaderContent()
            this._textManager.drawText()
            this._setEdtingTexts()
            this._selectionManager.type()
            this._type$.next()
        }))
        this.add(input.onKeyDown$
            .pipe(tap(e => {
                if (e.keyCodeId === KeyCodeId.BACKSPACE) {
                    const cursor = this._cursorManager
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
                    cursor.type([], removed)
                    this._selectionManager.keydown(e)
                    this._textManager.drawText()
                    return
                }
                if (e.keyCodeId === KeyCodeId.ENTER)
                    this._blur$.next()
            }))
            .subscribe(e => {
                this._keydown$.next(e)
            }))
        this.add(input.onPaste$.subscribe(e => {
            const text = e.clipboardMetaData[0]?.text
            if (text === undefined)
                return
            const line = this._cursorManager.lineNumber
            const column = this._cursorManager.column
            const added = this._textManager.add(text, line, column)
            this._cursorManager.type(added, [])
            this._textManager.drawText()
        }))
    }
}
