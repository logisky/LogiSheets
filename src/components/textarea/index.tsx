import { on, EventType, StandardKeyboardEvent } from '@/common/events'
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
import { ClipboardEvent, CompositionEvent, FocusEvent, KeyboardEvent, MouseEvent, useEffect, useRef } from 'react'
import { SuggestComponent } from '@/components/suggest'
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
        const textElement = textEl.current
        const selectionElement = selectionEl.current
        const textareaElement = textareaEl.current
        if (textElement)
            textMng.current.drawText(textElement)
        if (selectionElement)
            selectionMng.init(selectionElement)
        if (textareaElement)
            inputMng.current.init(textareaElement)
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
        sub.add(textMng.current.textChanged().subscribe(t => {
            type?.(t)
            suggestMng.onType()
        }))
        sub.add(focus$.subscribe(() => {
            inputMng.current.setFocus()
        }))
        return () => {
            // 目前不知道为什么点击到另一个单元格不会触发blur事件，只好这里先做这个blur这个事情
            _onBlur().then(shouldClose => {
                if (!shouldClose)
                    return
                sub.unsubscribe()
            })
        }
    }, [])

    const onHostMouseDown = (mde: MouseEvent) => {
        mde.stopPropagation()
        mde.preventDefault()
        if (!inputMng.current.hasFocus())
            inputMng.current.setFocus()
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
    const onHostInput = () => {
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
            return false
        }
        const event = new BlurEvent(
            context.bindingData,
        )
        blur?.(event)
        return true
    }

    const checkBlur = async () => {
        const formula = textMng.current.getPlainText()
        // 补全括号

        // 检查是否为合法公式(wasm)，再发往服务端
        const valid = await checkFormula(formula)
        if (!valid)
            return false

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
        <canvas className={styles['text-canvas']} ref={textEl}></canvas>
        <canvas className={styles['selection-canvas']} ref={selectionEl}></canvas>
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
        <CursorComponent
            height={cursorMng.cursorHeight}
            x={cursorMng.cursor$.x}
            y={cursorMng.cursor$.y}
        ></CursorComponent>
        <SuggestComponent
            show$={suggestMng.showSuggest$}
            close$={() => suggestMng.setShowSuggest(false)}
            select$={suggestMng.onSuggest}
            sugggestStyles={{ x: 0, y: context.cellHeight }}
            acitveCandidate={suggestMng.activeCandidate$}
            candidates={suggestMng.candidates$}
        ></SuggestComponent>
    </div>
}
