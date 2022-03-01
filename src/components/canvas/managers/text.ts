import { DATA_SERVICE } from 'core/data'
import { Context } from 'components/textarea'
import { Cell } from '../defs'
import { StandardKeyboardEvent } from 'common/events'
import { useRef, useState } from 'react'
import { shallowCopy } from 'common'
import { StartCellEvent } from './start-cell'
import initFc, { formula_check } from '../../../wasms/fc/pkg'

export const useText = () => {
    const [editing, setEditing] = useState(false)
    const [context, setContext] = useState<Context<Cell>>()
    const [validFormula, setValidFormula] = useState(false)
    const currText = useRef('')

    const _lastMouseDownTime = useRef(0)
    const canvas = useRef<HTMLCanvasElement>()

    const init = (c: HTMLCanvasElement) => {
        canvas.current = c
    }

    const blur = async () => {
        const check = await checkFormula()
        if (!check)
            return
        _setEditing(false)
    }
    const checkFormula = async () => {
        if (!editing)
            return true
        await initFc()
        const checked = formula_check(currText.current)
        setValidFormula(checked)
        if (!checked)
            console.log(`invalid formula ${currText.current}`)
        return checked
    }

    const keydown = (e: KeyboardEvent, startCell?: Cell) => {
        const standardEvent = new StandardKeyboardEvent(e)
        if (standardEvent.isKeyBinding)
            return
        if (startCell === undefined)
            return
        if (startCell.type !== 'Cell')
            return
        if (context === undefined)
            return
        const newContext = new Context<Cell>()
        shallowCopy(context, newContext)
        newContext.textareaOffsetX = -1
        newContext.textareaOffsetY = -1
        _setEditing(true, newContext)
    }

    const mousedown = (e: StartCellEvent) => {
        const { cell: startCell, same, event } = e
        const now = Date.now()
        const editing = (now - _lastMouseDownTime.current) < 300
        _lastMouseDownTime.current = now
        if (startCell === undefined || !canvas.current)
            return
        if (startCell.type !== 'Cell' || !same) {
            _setEditing(false)
            return
        }
        if (!editing) {
            _setEditing(false)
            return
        }
        const { height, width, coodinate: { startRow: row, startCol: col }, position: { startCol: x, startRow: y } } = startCell
        const info = DATA_SERVICE.sheetSvc.getCell(row, col)
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
        context.textareaOffsetX = (event as globalThis.MouseEvent).clientX - clientX
        context.textareaOffsetY = (event as globalThis.MouseEvent).clientY - clientY
        context.bindingData = startCell
        _setEditing(true, context)
    }

    const _setEditing = (isEditing: boolean, context?: Context<Cell>) => {
        if (isEditing === editing)
            return
        setEditing(isEditing)
        setContext(context)
    }
    const startCellChange = (e?: StartCellEvent) => {
        if (e?.from === 'mousedown')
            mousedown(e)
        else
            _setEditing(false)
    }
    return {
        editing,
        context,
        currText,
        validFormula,
        checkFormula,
        init,
        blur,
        keydown,
        startCellChange,
    }
}
