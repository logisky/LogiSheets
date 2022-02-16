import { on, EventType } from 'common/events'
import { useSelection, useCursor, InputManager, TextManager } from './managers'
import { Context } from './defs'
import { BlurEvent, CursorEvent } from './events'
import { CursorComponent } from './cursor'
import { MouseEvent, useEffect, useRef, useState } from 'react'
import { Subscription } from 'rxjs'
import styles from './textarea.module.scss'

export * from './events'
export * from './managers'
export * from './defs'

export interface TextContainerProps<T> {
    context: Context<T>
    blur?: (e: BlurEvent<T>) => void
    type?: (e: string) => void
    triggerText?: (e: string) => void
}

export const TextContainerComponent = <T,>(props: TextContainerProps<T>) => {
    const { context, blur, type, triggerText } = props
    const textMng = useRef(new TextManager(context))
    const cursorMng = useCursor(textMng.current, context)
    const selectionMng = useSelection(cursorMng, context, textMng.current)
    const inputMng = useRef(new InputManager(
        textMng.current,
        selectionMng,
        context,
        cursorMng,
    ))
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
        sub.add(inputMng.current.type$.subscribe(() => {
            type?.(textMng.current.getPlainText())
        }))
        return () => {
            // 点走到其他单元格，若当前单元格是输入状态，则触发blur事件
            _onBlur()
            sub.unsubscribe()
        }
    }, [])

    const onHostMouseDown = (mde: MouseEvent) => {
        /**
         * 当前组件应该在最底层，对于鼠标事件应仅限在该层中，不允许向上抛
         */
        mde.stopPropagation()
        mde.preventDefault()
        cursorMng.mousedown(mde)
        selectionMng.mousedown(mde)
        isMouseDown.current = true
    }


    const _onBlur = () => {
        const event = new BlurEvent(
            textMng.current.getPlainText(),
            context.bindingData,
        )
        blur?.(event)
    }
    return <div
        className={styles.host}
        onMouseDown={onHostMouseDown}
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
            height={context.cellHeight}
            x={cursorMng.cursor.x}
            y={cursorMng.cursor.y}
        ></CursorComponent>
    </div>
}
