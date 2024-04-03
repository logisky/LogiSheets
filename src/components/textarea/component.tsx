import { EventType, StandardKeyboardEvent, KeyboardEventCode } from '@/core/events'
import { observer } from 'mobx-react'
import { forwardRef, useImperativeHandle } from 'react'
import { Context, ITextareaInstance, Text } from './defs'
import { CursorComponent } from './cursor'
import {
    SyntheticEvent,
    useContext,
    useEffect,
    useRef,
} from 'react'
import styles from './textarea.module.scss'
import { TextareaContext, TextareaStore } from './store'
import { SuggestComponent } from '../suggest'

export interface TextContainerProps {
    context: Context
    blur: () => void
    type: (e: string) => void
}

export const TextContainerComponent = forwardRef((props: TextContainerProps, ref) => {
    const store = useRef(new TextareaStore(props.context))
    const internal = useRef()

    useImperativeHandle(ref, () => {
        return internal.current
    })
    return <TextareaContext.Provider value={store.current}>
        <InternalComponent ref={internal} {...props}></InternalComponent>
    </TextareaContext.Provider>
})

const InternalComponent = observer(forwardRef((props: TextContainerProps, ref) => {
    const { context, blur, type } = props
    const { cursor, selection } = useContext(TextareaContext)

    useImperativeHandle(ref, () => {
        return {
            focus: onFocus,
        } as ITextareaInstance
    })

    const textareaEl = useRef<HTMLTextAreaElement>(null)
    const textEl = useRef<HTMLCanvasElement>(null)
    const selectionEl = useRef<HTMLCanvasElement>(null)
    const store = useContext(TextareaContext)

    useEffect(() => {
        selection.init(selectionEl.current!)
    }, [])

    useEffect(() => {
        const sub = store.cursor.cursor$.subscribe(() => {
            type(store.textManager.getPlainText())
            store.suggest.onType()
            store.selection.clear()
        })
        return () => {
            sub.unsubscribe()
        }
    }, [])

    const onBlur = (event: SyntheticEvent) => {
        // TODO: implement brace if has formula
        // store.cursor.blur()
        // blur()
    }

    const onType = (value: string, event: SyntheticEvent) => {
        if (textareaEl.current) {
            textareaEl.current.value = ''
        }
        const newTexts = store.textManager.add(value)
        store.cursor.type(newTexts, [])
    }

    const onFocus = () => {
        setTimeout(() => {
            textareaEl.current?.focus()
            if (textEl.current)
                store.textManager.drawText(textEl.current)
            store.cursor.focus()
        })
    }

    const handleEvent = async (event: SyntheticEvent) => {
        const type = event.type
        switch (type) {
            case EventType.FOCUS:
                onFocus()
                break
            case EventType.BLUR:
                onBlur(event)
                break
            case EventType.KEY_DOWN: {
                const e = new StandardKeyboardEvent(event.nativeEvent as any)
                const disableInput = () => {
                    e.e.returnValue = false
                }
                if (store.isComposing) {
                    disableInput()
                    return
                }
                switch (e.keyCodeId) {
                    case KeyboardEventCode.DELETE:
                    case KeyboardEventCode.BACKSPACE: {
                        disableInput()
                        let removed: readonly Text[] = []
                        if (store.selection.selection) {
                            const { startLine, endLine, startColumn, endColumn } = store.selection.selection
                            removed = store.textManager.removeInTwoDimensional({
                                startLine,
                                endLine,
                                startColumn,
                                endColumn: endColumn - 1 < 0 ? 0 : endColumn - 1
                            })
                        } else {
                            const currPosition = store.cursor.cursorPosition
                            if (currPosition === 0) return
                            removed = store.textManager.remove(currPosition - 1, currPosition - 1)
                        }
                        store.cursor.type([], removed)
                        break
                    }
                    case KeyboardEventCode.ENTER: {
                        disableInput()
                        if (store.suggest.showSuggest) {
                            store.suggest.onSuggest()
                            return
                        }
                        else if (e.isAlt()) {
                            onType(store.context.eof, event)
                        } else
                            return onBlur(event)
                        break
                    }
                    case KeyboardEventCode.ARROW_LEFT: {
                        disableInput()
                        const line = store.cursor.lineNumber
                        const column = store.cursor.column
                        store.cursor.updateTwoDimensionalPosition(line, column - 1)
                        break
                    }
                    case KeyboardEventCode.ARROW_RIGHT: {
                        disableInput()
                        const line = store.cursor.lineNumber
                        const column = store.cursor.column
                        store.cursor.updateTwoDimensionalPosition(line, column + 1)
                        break
                    }
                    case KeyboardEventCode.ARROW_UP: {
                        disableInput()
                        if (store.suggest.showSuggest) {
                            store.suggest.activeCandidate -= 1
                            return
                        }
                        const line = store.cursor.lineNumber
                        const column = store.cursor.column
                        store.cursor.updateTwoDimensionalPosition(line - 1, column)
                        break
                    }
                    case KeyboardEventCode.ARROW_DOWN: {
                        disableInput()
                        if (store.suggest.showSuggest) {
                            store.suggest.activeCandidate += 1
                            return
                        }
                        const line = store.cursor.lineNumber
                        const column = store.cursor.column
                        store.cursor.updateTwoDimensionalPosition(line + 1, column)
                        break
                    }
                    default:
                }
                break
            }
            case EventType.INPUT: {
                if (store.isComposing) {
                    return
                }
                const currValue: string = (event.nativeEvent.target as any)?.value ?? ''
                let inputValue = currValue.at(-1) || ''
                onType(inputValue, event)
                break
            }
            case EventType.COMPOSITION_START:
                store.cursor.compositionStart = store.cursor.cursorPosition
                store.setComposing(true)
                break
            case EventType.COMPOSITION_END: {
                const currValue: string = (event.nativeEvent.target as any)?.value ?? ''
                onType(currValue, event)
                store.cursor.compositionStart = -1
                store.setComposing(false)
                break
            }
            case EventType.MOUSE_DOWN: {
                event.preventDefault()
                event.stopPropagation()
                store.cursor.mousedown(event.nativeEvent as any)
                store.isMousedown = true
                break
            }
            case EventType.MOUSE_MOVE: {
                event.preventDefault()
                if (store.isMousedown)
                    store.selection.mousemove(event.nativeEvent as any)
                break
            }
            case EventType.MOUSE_UP: {
                event.preventDefault()
                store.isMousedown = false
                break
            }
            default:
        }
    }

    return (
        <div
            onCompositionStart={handleEvent}
            onCompositionUpdate={handleEvent}
            onCompositionEnd={handleEvent}
            onInput={handleEvent}
            onCut={handleEvent}
            onCopy={handleEvent}
            onPaste={handleEvent}
            onFocus={handleEvent}
            onBlur={handleEvent}
            className={styles.host}
            onKeyDown={handleEvent}
            onMouseDown={handleEvent}
            onMouseMove={handleEvent}
            onMouseUp={handleEvent}
            style={{
                left: `${context.canvasOffsetX}px`,
                top: `${context.canvasOffsetY}px`,
                width: `${context.cellWidth}px`,
                height: `${context.cellHeight}px`,
            }}
        >
            <canvas className={styles['text-canvas']} ref={textEl}></canvas>
            <canvas style={{ position: 'absolute', backgroundColor: 'transparent' }} ref={selectionEl} />
            <textarea
                ref={textareaEl}
                className={`${styles['inputarea']} ${styles['input-text-cursor']}`}
                wrap="off"
                autoCorrect="off"
                autoComplete="off"
                autoFocus={true}
                spellCheck="false"
                aria-autocomplete="both"
                aria-multiline="true"
                aria-haspopup="false"
            ></textarea>
            {cursor.showCursor && <CursorComponent
                height={context.cellHeight}
                x={cursor.x}
                y={cursor.y}
            />}
            <SuggestComponent
                show$={store.suggest.showSuggest}
                close$={() => store.suggest.showSuggest = false}
                select$={store.suggest.onSuggest}
                sugggestStyles={{ x: 0, y: context.cellHeight }}
                acitveCandidate={store.suggest.activeCandidate}
                candidates={store.suggest.candidates}
            />
        </div>
    )
}))