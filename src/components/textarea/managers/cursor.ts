import {BaseInfo} from '../cursor'
import {Text, Context} from '../defs'
import {TextManager} from './text'
import {KeyboardEventCode, StandardKeyboardEvent} from '@/core/events'
import {MouseEvent, useRef, useState} from 'react'
import {CursorEvent} from '../events'

export const useCursor = <T>(textMng: TextManager<T>, context: Context<T>) => {
    // 将单元格内输入内容拉平成一行之后，算cursor的位置
    const getCursorInOneLine = () => {
        const texts = textMng.getTwoDimensionalTexts()
        let result = 0
        const {lineNumber, column} = currCursor.current
        texts.forEach((eachLine, line) => {
            if (line > lineNumber) return
            if (line < lineNumber) {
                const length = eachLine.reduce((a, b) => a + b.char.length, 0)
                result += length
            } else result += column
        })
        return result
    }
    const getCursorInfoByOneLineCoordinate = (cursor: number) => {
        const texts = textMng.getTwoDimensionalTexts()
        let currIndex = 0
        let lineNumber = 0,
            column = 0
        for (let line = 0; line < texts.length; line++) {
            const eachLine = texts[line]
            const lineLength = eachLine.reduce((a, b) => a + b.char.length, 0)
            const index = lineLength + currIndex
            if (index < cursor) {
                currIndex += lineLength
                continue
            } else if (index >= cursor) {
                lineNumber = line
                column = cursor - currIndex
                break
            } else return
        }
        return getCursorInfoByCoordinate(lineNumber, column)
    }
    // 根据坐标获取光标的pixel位置
    const getCursorInfoByCoordinate = (line: number, column: number) => {
        const baseInfo = new BaseInfo()
        baseInfo.column = column
        baseInfo.lineNumber = line
        baseInfo.y = line * context.lineHeight()
        const texts = textMng.getTwoDimensionalTexts()
        let x = 0
        for (let i = 0; i < texts[line].length && i < column; i++) {
            x += texts[line][i].width()
        }
        baseInfo.x = x
        return baseInfo
    }
    /**
     * 如果offsetX为-1，则cursorX为当前行的最后
     * 如果offsetY为-1，则cursorY为最后一行
     */
    const getCursorInfoByPosition = (offsetX: number, offsetY: number) => {
        const lineNumber = Math.floor(offsetY / context.lineHeight())
        const baseInfo = new BaseInfo()
        baseInfo.lineNumber = lineNumber
        baseInfo.y = lineNumber * context.lineHeight()
        const texts = textMng.getTwoDimensionalTexts()
        if (texts.length === 0) return baseInfo
        if (offsetY === -1)
            baseInfo.y = (texts.length - 1) * context.lineHeight()
        let currLineTexts = texts[lineNumber]
        if (currLineTexts === undefined) {
            const l = texts.length - 1
            baseInfo.lineNumber = l
            baseInfo.y = l * context.lineHeight()
            currLineTexts = texts[l]
        }
        if (offsetX === -1) {
            let x = 0
            currLineTexts.forEach((t) => {
                x += t.width()
            })
            baseInfo.x = x
            baseInfo.column = currLineTexts.length
            return baseInfo
        }
        let column = 0
        let x = 0
        for (let i = 0; i < currLineTexts.length; i += 1) {
            const t = currLineTexts[i]
            if (t === undefined) continue
            if (t.width() + x >= offsetX) {
                const half = t.width() / 2
                if (x + half >= offsetX) column = i
                else {
                    column = i + 1
                    x += t.width()
                }
                break
            }
            x += t.width()
            column = i + 1
        }
        baseInfo.column = column
        baseInfo.x = x
        return baseInfo
    }
    const type = (added: readonly Text[], removed: readonly Text[]) => {
        let x = currCursor.current.x
        let y = currCursor.current.y
        const [maxWidth] = textMng.getNewSize()
        removed.forEach((t) => {
            if (t.isEof) {
                y -= context.lineHeight()
                x = maxWidth
                return
            }
            x -= t.width()
        })
        added.forEach((t) => {
            if (t.isEof) {
                y += context.lineHeight()
                x = 0
                return
            }
            x += t.width()
        })
        _update(getCursorInfoByPosition(x, y))
    }

    const keydown = (e: StandardKeyboardEvent) => {
        const {x: cursorX, y: cursorY, lineNumber, column} = currCursor.current
        const texts = textMng.getTwoDimensionalTexts()
        if (e.keyCodeId === KeyboardEventCode.ARROW_RIGHT) {
            const next = texts[lineNumber][column]
            if (next === undefined) return
            const newCursor = getCursorInfoByPosition(
                cursorX + next.width(),
                cursorY
            )
            if (newCursor.x === cursorX) return
            _update(newCursor)
        } else if (e.keyCodeId === KeyboardEventCode.ARROW_LEFT) {
            if (column === 0) return
            const last = texts[lineNumber][column - 1]
            const newCursor = getCursorInfoByPosition(
                cursorX - last.width(),
                cursorY
            )
            if (newCursor.x === cursorX) return
            _update(newCursor)
        } else if (e.keyCodeId === KeyboardEventCode.ARROW_DOWN) {
            const next = texts[lineNumber + 1]
            if (next === undefined) return
            const newCursor = getCursorInfoByPosition(
                cursorX,
                cursorY + context.lineHeight()
            )
            _update(newCursor)
        } else if (e.keyCodeId === KeyboardEventCode.ARROW_UP) {
            if (lineNumber === 0) return
            const newCursor = getCursorInfoByPosition(
                cursorX,
                cursorY - context.lineHeight()
            )
            _update(newCursor)
        } else if (e.keyCodeId === KeyboardEventCode.ENTER) blur()
        else if (e.keyCodeId === KeyboardEventCode.ESCAPE) blur()
    }

    const focus = () => {
        _update()
    }

    const blur = () => {
        const resetCursor = new BaseInfo()
        _update(resetCursor)
    }

    const mousedown = (e: MouseEvent) => {
        const [x, y] = context.getOffset(e.clientX, e.clientY)
        const cursor = getCursorInfoByPosition(x, y)
        _update(cursor)
    }
    const setCursor = (cursor: number) => {
        const cursorInfo = getCursorInfoByOneLineCoordinate(cursor)
        _update(cursorInfo)
    }
    const _update = (cursor?: BaseInfo) => {
        const cursorEvent = new CursorEvent()
        cursorEvent.show = cursor !== undefined
        if (cursor !== undefined) {
            setCursorInfo(cursor)
            currCursor.current = cursor
            const clientX = cursor.x + context.clientX
            const clientY = cursor.y + context.clientY
            cursorEvent.clientX = clientX
            cursorEvent.clientY = clientY
            cursorEvent.columnNumber = cursor.column
            cursorEvent.lineNumber = cursor.lineNumber
            cursorEvent.offsetX = cursor.x
            cursorEvent.offsetY = cursor.y
        }
        setCursorEvent(cursorEvent)
    }

    const [cursorEvent$, setCursorEvent] = useState<CursorEvent>()
    const [cursor$, setCursorInfo] = useState<BaseInfo>(
        getCursorInfoByPosition(
            context.textareaOffsetX,
            context.textareaOffsetY
        )
    )
    const currCursor = useRef(cursor$)
    return {
        cursorEvent$,
        cursor$,
        currCursor,
        cursorHeight: context.cellHeight,
        getCursorInfoByPosition,
        type,
        mousedown,
        blur,
        keydown,
        focus,
        getCursorInOneLine,
        setCursor,
    }
}
