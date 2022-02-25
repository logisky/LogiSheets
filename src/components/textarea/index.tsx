import { on, EventType, StandardKeyboardEvent } from 'common/events'
import {
    useSelection,
    useCursor,
    InputManager,
    TextManager,
    useSuggest,
} from './managers'
import { Context } from './defs'
import { BlurEvent } from './events'
import { CursorComponent } from './cursor'
import { ClipboardEvent, CompositionEvent, FocusEvent, FormEvent, KeyboardEvent, MouseEvent, useEffect, useRef } from 'react'
import { Candidate, SuggestComponent } from 'components/suggest'
import { Subscription, Observable } from 'rxjs'
import styles from './textarea.module.scss'

export * from './events'
export * from './managers'
export * from './defs'

export interface TextContainerProps<T> {
    context: Context<T>
    blur?: (e: BlurEvent<T>) => void
    type?: (e: string) => void
    checkFormula: (text?: string) => Promise<boolean>
    focus$: Observable<void>
}

export const TextContainerComponent = <T,>({
    context,
    blur,
    type,
    checkFormula,
    focus$,
}: TextContainerProps<T>) => {
    const textMng = useRef(new TextManager(context))
    const cursorMng = useCursor(textMng.current, context)
    const selectionMng = useSelection(cursorMng, context, textMng.current)
    const inputMng = useRef(new InputManager(
        textMng.current,
        selectionMng,
        context,
        cursorMng,
    ))
    const suggestMng = useSuggest<T>(textMng.current, cursorMng)
    const isMouseDown = useRef(false)

    const textEl = useRef<HTMLCanvasElement>(null)
    const selectionEl = useRef<HTMLCanvasElement>(null)
    const textareaEl = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        const textElement = textEl.current!
        const selectionElement = selectionEl.current!
        const textareaElement = textareaEl.current!
        textMng.current.drawText(textElement)
        selectionMng.init(selectionElement)
        inputMng.current.init(textareaElement)
        // 仅为了拿到最新的元素所以放在useEffect里面
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [context])
    useEffect(() => {
        const sub = new Subscription()
        sub.add(on(window, EventType.MOUSE_MOVE).subscribe(mme => {
            if (!isMouseDown.current)
                return
            mme.preventDefault()
            selectionMng.mousemove(mme)
        }))
        sub.add(on(window, EventType.MOUSE_UP).subscribe(mue => {
            if (!isMouseDown.current)
                return
            mue.preventDefault()
            isMouseDown.current = false
            sub.unsubscribe()
        }))
        sub.add(inputMng.current.blur$.subscribe(() => {
            _onBlur()
        }))
        sub.add(textMng.current.textChanged().subscribe(t => {
            type?.(t)
            suggestMng.onType()
        }))
        sub.add(suggestMng.suggest$.current.subscribe(s => {
            if (!s)
                return
            onSuggest(s)
        }))
        sub.add(focus$.subscribe(() => {
            inputMng.current.setFocus()
        }))
        return () => {
            sub.unsubscribe()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const onHostMouseDown = (mde: MouseEvent) => {
        mde.stopPropagation()
        mde.preventDefault()
        cursorMng.mousedown(mde)
        selectionMng.mousedown(mde)
        isMouseDown.current = true
    }
    const onHostKeyDown = (e: KeyboardEvent) => {
        e.stopPropagation()
        const event = new StandardKeyboardEvent(e.nativeEvent)
        const finish = suggestMng.onKeydown(event)
        if (finish)
            return
        inputMng.current.textareaInput?.onKeydown(e.nativeEvent)
    }
    const onHostKeyup = (e: KeyboardEvent) => {
        inputMng.current.textareaInput?.onKeyup(e.nativeEvent)
    }
    const onHostCompositionStart = (e: CompositionEvent) => {
        inputMng.current.textareaInput?.onCompositionnStart(e.nativeEvent)
    }
    const onHostCompositionUpdate = (e: CompositionEvent) => {
        inputMng.current.textareaInput?.onCompositionUpdate(e.nativeEvent)
    }
    const onHostCompositionEnd = (e: CompositionEvent) => {
        inputMng.current.textareaInput?.onCompositionEnd(e.nativeEvent)
    }
    const onHostInput = (e: FormEvent) => {
        inputMng.current.textareaInput?.onInput()
    }
    const onHostCut = (e: ClipboardEvent) => {
        inputMng.current.textareaInput?.onCut(e.nativeEvent)
    }
    const onHostCopy = (e: ClipboardEvent) => {
        inputMng.current.textareaInput?.onCopy(e.nativeEvent)
    }
    const onHostPaste = (e: ClipboardEvent) => {
        inputMng.current.textareaInput?.onPaste(e.nativeEvent)
    }
    const onHostFocus = (e: FocusEvent) => {
        inputMng.current.textareaInput?.onFocus(e.nativeEvent)
    }
    const onHostBlur = () => {
        inputMng.current.textareaInput?.onBlur()
    }


    const _onBlur = async () => {
        const check = await checkBlur()
        if (!check) {
            inputMng.current.setFocus()
            return
        }
        const event = new BlurEvent(
            context.bindingData,
        )
        blur?.(event)
    }

    const onSuggest = (candidate: Candidate) => {
        suggestMng.setShowSuggest(false)
        const replaceRange = suggestMng.replaceRange.current
        if (!replaceRange)
            return
        console.log(replaceRange)
        textMng.current.replace(candidate.plainText, replaceRange.start, replaceRange.count)
        // 将光标设到函数括号中间
        if (candidate.quoteStart) {
            const newCursor = replaceRange.start + candidate.quoteStart + 1
            cursorMng.setCursor(newCursor)
        }
    }

    const checkBlur = async () => {
        const formula = textMng.current.getPlainText()
        // 补全括号

        // 检查是否为合法公式(wasm)，再发往服务端
        const valid = await checkFormula(formula)
        if (!valid) {
            console.log(`invalid formula, ${formula}`)
            return false
        }

        return true
    }
    return <div
        onKeyUp={onHostKeyup}
        onCompositionStart={onHostCompositionStart}
        onCompositionUpdate={onHostCompositionUpdate}
        onCompositionEnd={onHostCompositionEnd}
        onInput={onHostInput}
        onCut={onHostCut}
        onCopy={onHostCopy}
        onPaste={onHostPaste}
        onFocus={onHostFocus}
        onBlur={onHostBlur}
        className={styles.host}
        onMouseDown={onHostMouseDown}
        onKeyDown={onHostKeyDown}
        style={{
            left: `${context.canvasOffsetX}px`,
            top: `${context.canvasOffsetY}px`,
            width: `${context.cellWidth}px`,
            height: `${context.cellHeight}px`,
        }}
    >
        <canvas className={styles["text-canvas"]} ref={textEl}></canvas>
        <canvas className={styles["selection-canvas"]} ref={selectionEl}></canvas>
        <textarea
            ref={textareaEl}
            className={`${styles["inputarea"]} ${styles["input-text-cursor"]}`}
            wrap="off"
            autoCorrect="off"
            autoComplete="off"
            autoFocus={true}
            spellCheck="false"
            aria-autocomplete="both"
            aria-multiline="true"
            aria-haspopup="false"
        ></textarea>
        <CursorComponent
            height={cursorMng.cursorHeight}
            x={cursorMng.cursor$.x}
            y={cursorMng.cursor$.y}
        ></CursorComponent>
        <SuggestComponent
            show$={suggestMng.showSuggest$}
            close$={() => suggestMng.setShowSuggest(false)}
            select$={onSuggest}
            sugggestStyles={{ x: 0, y: context.cellHeight }}
            acitveCandidate={suggestMng.activeCandidate$}
            candidates={suggestMng.candidates$}
        ></SuggestComponent>
    </div>
}
