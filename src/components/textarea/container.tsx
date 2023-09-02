import { observer, useLocalStore } from 'mobx-react'
import { Modal } from 'antd'
import initFc, { formula_check } from '../../wasms/fc/pkg/logisheets_wasm_fc'
import {
    useCursor,
    useInputManager,
    useSuggest,
    internalTextareaStore,
    EventType,
} from './managers'
import { BlurEvent } from './events'
import { CursorComponent } from './cursor'
import {
    SyntheticEvent,
    useEffect,
    useRef,
} from 'react'
import { SuggestComponent } from '@/components/suggest'
import { useEventListener } from 'ahooks'
import styles from './textarea.module.scss'
import { textareaStore } from './stores'
import { TextContainerProps } from './types'
import { isFormula } from '@/core/snippet'
import { autorun } from 'mobx'

export const TextContainerComponent = observer(<T,> (props: TextContainerProps<T>) => {
    const { blur, type } = props
    const isMouseDown = useRef(false)
    const textarea = useLocalStore(() => textareaStore)
    const store = useLocalStore(() => internalTextareaStore)

    const textEl = useRef<HTMLCanvasElement>(null)
    const selectionEl = useRef<HTMLCanvasElement>(null)
    const textareaEl = useRef<HTMLTextAreaElement>(null)
    const hostEl = useRef<HTMLDivElement>(null)

    useSuggest()
    useCursor(selectionEl)
    useInputManager({ textareaElement: textareaEl, renderTextElement: textEl })
    useEffect(() => {
        return () => {
            // 目前不知道为什么点击到另一个单元格不会触发blur事件，只好这里先做这个blur这个事情
            _onBlur().then((shouldClose) => {
                if (!shouldClose) return
            })
        }
    }, [])
    useEffect(() =>{

    }, [textarea.editing])
    useEffect(() => {
        autorun(() => {
            if (!textarea.editing) textareaEl.current?.blur()
            else textareaEl.current?.focus()
        })
    })

    const _onBlur = async () => {
        const check = await checkBlur()
        if (!check) {
            store.emit('focus')
            return false
        }
        const event = new BlurEvent(textarea.context.bindingData)
        blur?.(event, store.texts.getPlainText())
        return true
    }

    const checkBlur = async () => {
        const formula = store.texts.getPlainText()
        // TODO(liminglong): 补全括号

        // 检查是否为合法公式(wasm)，再发往服务端
        if (!isFormula(formula)) return true
        await initFc()
        const checked = formula_check(formula)
        if (!checked)
            Modal.error({
                title: '公式错误',
                content: '如果您输入的内容不是公式，请在第一个字符之前输入单引号。',
            })
        return checked
    }
    const handleEvent = (e: SyntheticEvent) => {
        if (e.type === 'mousedown') {
            isMouseDown.current = true
            useEventListener('mousemove', (e) => {
                e.preventDefault()
                store.emit('mousemove', e)
            })
            useEventListener('mouseup', e => {
                isMouseDown.current = false
                e.preventDefault()
                store.emit('mouseup', e)
            })
        }
        e.stopPropagation()
        e.preventDefault()
        store.emit(e.type as EventType, e)
    }
    return (
        <div
            ref={hostEl}
            onKeyUp={handleEvent}
            onCompositionStart={handleEvent}
            onCompositionUpdate={handleEvent}
            onCompositionEnd={handleEvent}
            onInput={handleEvent}
            onCut={handleEvent}
            onCopy={handleEvent}
            onPaste={handleEvent}
            onFocus={handleEvent}
            onBlur={handleEvent}
            onKeyDown={handleEvent}
            onMouseDown={handleEvent}
            className={`${styles.host}`}
            style={{
                display: textareaStore.editing ? '' : 'none',
                left: `${textarea.context.canvasOffsetX}px`,
                top: `${textarea.context.canvasOffsetY}px`,
                width: `${textarea.context.cellWidth}px`,
                height: `${textarea.context.cellHeight}px`,
            }}
        >
            <canvas className={styles['text-render-canvas']} ref={textEl}></canvas>
            <canvas
                className={styles['selection-canvas']}
                ref={selectionEl}
            ></canvas>
            {/* <textarea
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
            ></textarea> */}
            <CursorComponent></CursorComponent>
            <SuggestComponent sugggestStyles={{ x: 0, y: textarea.context.cellHeight }}></SuggestComponent>
        </div>
    )
})
