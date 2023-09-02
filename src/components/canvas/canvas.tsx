import { SelectedCell } from './events'
import { observer, useLocalStore } from 'mobx-react'
import { useEventListener } from 'ahooks'
import styles from './canvas.module.scss'
import { MouseEvent, useRef, FC, SyntheticEvent } from 'react'
import {
    useSelector,
    useScrollbar,
    useDnd,
    useText,
    useRender,
    useHighlightCell,
    useResizers,
} from './widgets'
import { Cell, match } from './defs'
import { ScrollbarComponent } from '@/components/scrollbar'
import { ContextmenuComponent } from './contextmenu'
import { SelectorComponent, selectorStore } from '@/components/selector'
import { ResizerComponent } from '@/components/resize'
import { BlurEvent, TextareaComponent, textareaStore } from '@/components/textarea'
import { DndComponent } from '@/components/dnd'
import { Buttons } from '@/core'
import { CellInputBuilder } from '@/api'
import { useInjection } from '@/core/ioc/provider'
import { Backend, DataService, SheetService } from '@/core/data'
import { TYPES } from '@/core/ioc/types'
import { EventType, canvasStore as _canvasStore, canvasStore } from './store'
import { createSyntheticEvent } from '@/core/events'
export const OFFSET = 100

export interface CanvasProps {
    selectedCell$: (e: SelectedCell) => void
}

export const CanvasComponent: FC<CanvasProps> = observer(({ selectedCell$ }) => {
    const canvasEl = useRef<HTMLCanvasElement>()
    const BACKEND_SERVICE = useInjection<Backend>(TYPES.Backend)
    const SHEET_SERVICE = useInjection<SheetService>(TYPES.Sheet)
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const selector = useLocalStore(() => selectorStore)
    const textarea = useLocalStore(() => textareaStore)
    const host = useLocalStore(() => canvasStore)

    useScrollbar()
    useSelector()
    useDnd()
    const highlights = useHighlightCell()
    const resizerMng = useResizers()
    useRender()
    useText()

    useEventListener('mouseup', e => {
        handleEvent(createSyntheticEvent(e))
    })
    useEventListener('mousemove', e => {
        e.preventDefault()
        e.stopPropagation()
        const startCell = match(
            e.clientX,
            e.clientY,
            canvasEl.current!,
            DATA_SERVICE.cachedViewRange
        )
        if (!startCell) return
        host.emit('mousemove', { e, startCell })
    })

    const blur = (e: BlurEvent<Cell>, text?: string) => {
        const oldText = textarea.context?.text ?? ''
        if (e.bindingData === undefined) return
        const newText = (text ?? '').trim()
        if (oldText === newText) return
        const payload = new CellInputBuilder()
            .row(e.bindingData.coodinate.startRow)
            .col(e.bindingData.coodinate.startCol)
            .sheetIdx(SHEET_SERVICE.getActiveSheet())
            .input(newText)
            .build()
        BACKEND_SERVICE.sendTransaction([payload])
        host.emit('blur', { e, text })
    }
    const handleEvent = (e: SyntheticEvent) => {
        e.stopPropagation()
        e.preventDefault()
        host.emit(e.type as EventType, e)
    }
    const onMouseDown = async (e: MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        if (e.buttons === Buttons.RIGHT) {
            return
        }
        const matchCell = match(
            e.clientX,
            e.clientY,
            canvasEl.current!,
            DATA_SERVICE.cachedViewRange
        )
        host.emit('mousedown', { e, cell: matchCell })
    }
    const onContextMenu = (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const matchCell = match(
            e.clientX,
            e.clientY,
            canvasEl.current!,
            DATA_SERVICE.cachedViewRange
        )
        if (!matchCell) return
        host.emit('contextmenu', { e, cell: matchCell })
    }

    return (
        <div
            onContextMenu={onContextMenu}
            onMouseDown={onMouseDown}
            onInput={handleEvent}
            onClick={e => {
                if (selector.startCell) {
                    const { startRow, startCol } = selector.startCell.coodinate
                    selectedCell$({ row: startRow, col: startCol })
                }
                host.emit('click', e)
            }}
            className={styles.host}
        >
            <canvas
                className={styles.canvas}
                ref={el => {
                    if (!el) return
                    host.setCanvas(el)
                    canvasEl.current = el
                }}
                onWheel={e => host.emit('wheel', e)}
            >
                你的浏览器不支持canvas，请升级浏览器
            </canvas>
            <ContextmenuComponent></ContextmenuComponent>
            <SelectorComponent></SelectorComponent>
            <ScrollbarComponent direction='x'></ScrollbarComponent>
            <ScrollbarComponent direction='y'></ScrollbarComponent>
            <TextareaComponent
                blur={blur}
                type={text => host.emit('type', text)}
            ></TextareaComponent>
            <DndComponent ></DndComponent>
            {highlights.highlightCells.map((cell, i) => {
                const cellStyle = cell.style
                return (
                    <div
                        className={styles['highlight-cell']}
                        style={{
                            left: cellStyle.x,
                            top: cellStyle.y,
                            width: `${cellStyle.width}px`,
                            height: `${cellStyle.height}px`,
                            backgroundColor: cellStyle.bgColor.css(),
                        }}
                        key={i}
                    ></div>
                )
            })}
            {resizerMng.resizers.map((resizer, i) => {
                const { startCol: x, startRow: y, width, height } = resizer.range
                const { isRow } = resizer
                const rect = (
                    canvasEl.current as HTMLCanvasElement
                ).getBoundingClientRect()
                return (
                    <ResizerComponent
                        hoverText={resizerMng.hoverText}
                        x={!isRow ? x : 0}
                        y={!isRow ? 0 : y}
                        width={width}
                        height={height}
                        key={i}
                        movingX={!isRow ? resizerMng.moving.x : 0}
                        movingY={isRow ? resizerMng.moving.y : 0}
                        movingHeight={!isRow ? rect.height : 0}
                        movingWidth={!isRow ? 0 : rect.width}
                        active={resizerMng.active === resizer}
                        type={isRow ? 'row' : 'col'}
                    ></ResizerComponent>
                )
            })}
        </div>
    )
})
