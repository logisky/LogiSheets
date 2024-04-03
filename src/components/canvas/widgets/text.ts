import {Context} from '@/components/textarea'
import {Cell} from '../defs'
import {StandardKeyboardEvent} from '@/core/events'
import {RefObject, useRef, useState} from 'react'
import {shallowCopy} from '@/core'
import {StartCellEvent} from './start-cell'
import initFc, {
    formula_check,
} from '../../../../crates/wasms/fc/pkg/logisheets_wasm_fc'
import {isFormula} from '@/core/snippet'
import {Backend, SheetService} from '@/core/data'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import { CellInputBuilder } from '@logisheets_bg'

interface TextProps {
    readonly canvas: RefObject<HTMLCanvasElement>
    readonly onEdit: (editing: boolean, text?: string) => void
}

export const useText = ({canvas, onEdit}: TextProps) => {
    const SHEET_SERVICE = useInjection<SheetService>(TYPES.Sheet)
    const BACKEND_SERVICE = useInjection<Backend>(TYPES.Backend)
    const [editing, setEditing] = useState(false)
    const [context, setContext] = useState<Context<Cell>>()
    const currText = useRef('')

    const _lastMouseDownTime = useRef(0)

    const blur = async () => {
        if (!editing) return true
        const newText = currText.current.trim()
        const checked = await checkFormula(newText)
        if (!checked || !context?.bindingData) return false
        _setEditing(false)
        const payload = new CellInputBuilder()
            .row(context.bindingData.coordinate.startRow)
            .col(context.bindingData.coordinate.startCol)
            .sheetIdx(SHEET_SERVICE.getActiveSheet())
            .input(newText)
            .build()
        BACKEND_SERVICE.sendTransaction([payload])
        return true
    }

    const keydown = (e: KeyboardEvent, startCell?: Cell) => {
        const standardEvent = new StandardKeyboardEvent(e)
        if (standardEvent.isKeyBinding) return
        if (startCell === undefined) return
        if (startCell.type !== 'Cell') return
        if (context === undefined) return
        const newContext = new Context<Cell>()
        shallowCopy(context, newContext)
        newContext.textareaOffsetX = -1
        newContext.textareaOffsetY = -1
        _setEditing(true, newContext)
    }

    const mousedown = (e: StartCellEvent) => {
        const {cell: startCell, same, event} = e
        const now = Date.now()
        const editing = now - _lastMouseDownTime.current < 300
        _lastMouseDownTime.current = now
        if (startCell === undefined || !canvas.current) return
        if (startCell.type !== 'Cell' || !same) {
            _setEditing(false)
            return
        }
        if (!editing) {
            _setEditing(false)
            return
        }
        const {
            height,
            width,
            coordinate: {startRow: row, startCol: col},
            position: {startCol: x, startRow: y},
        } = startCell
        const info = SHEET_SERVICE.getCell(row, col)
        const text = info?.formula ? info.getFormular() : info?.getText() ?? ''
        const rect = canvas.current.getBoundingClientRect()
        const [clientX, clientY] = [rect.x + x, rect.y + y]
        const context = new Context<Cell>()
        context.text = text
        context.canvasOffsetX = x
        context.canvasOffsetY = y
        context.clientX = clientX ?? -1
        context.clientY = clientY ?? -1
        context.cellHeight = height
        context.cellWidth = width
        context.bindingData = startCell
        context.textareaOffsetX =
            (event as globalThis.MouseEvent).clientX - clientX
        context.textareaOffsetY =
            (event as globalThis.MouseEvent).clientY - clientY
        context.bindingData = startCell
        _setEditing(true, context)
    }

    const _setEditing = (isEditing: boolean, context?: Context<Cell>) => {
        if (isEditing === editing) return
        setEditing(isEditing)
        setContext(context)
        onEdit(isEditing, currText.current)
    }
    const startCellChange = (e: StartCellEvent) => {
        if (e.from === 'mousedown') mousedown(e)
        else _setEditing(false)
    }
    return {
        editing,
        context,
        currText,
        blur,
        keydown,
        startCellChange,
    }
}


const checkFormula = async (formula: string) => {
    if (!isFormula(formula)) return true
    await initFc()
    return formula_check(formula)
}