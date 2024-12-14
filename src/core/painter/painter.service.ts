/* eslint-disable max-lines */
import {BorderPr, StPatternType} from 'logisheets-web'
import {StandardColor} from '@/core/standable'
import {CanvasAttr} from './canvas_attr'
import {Box} from './box'
import {CanvasApi} from './canvas'
import {useToast} from '@/ui/notification/useToast'

import {npx, npxLine, thinLineWidth} from './utils'
import {Direction} from '@/core'
import {TextAttr} from './text_attr'

export class PainterService extends CanvasApi {
    fillFgColor(type: StPatternType, color: string, box: Box) {
        this.save()
        const attr = new CanvasAttr()
        attr.fillStyle = color
        this.attr(attr)
        switch (type) {
            case 'solid':
                {
                    const {startRow: y, startCol: x} = box.position
                    this.fillRect(x, y, box.width, box.height)
                }
                break
            default:
        }
        this.restore()
    }

    comment(box: Box): void {
        this.save()
        const attr = new CanvasAttr()
        /**
         * TODO(minglong): 'red' should be set in global settings
         */
        attr.fillStyle = 'red'
        this.attr(attr)
        const hypotenuse = Math.ceil(box.height / 5)
        this.fillRect(
            box.position.endCol - hypotenuse,
            box.position.startRow,
            hypotenuse,
            hypotenuse
        )
        this.restore()
    }

    border(border: BorderPr, box: Box, type: Direction) {
        this.save()
        const stdColor = StandardColor.fromCtColor(border.color)
        const dot = npx(1)
        const hair = dot / 2
        const dash = npx(3)
        const thinLine = thinLineWidth()
        const mediumLine = npx(2) - 0.5
        const thickLine = npx(3)
        const segments = []
        const borderAttr = new CanvasAttr()
        borderAttr.strokeStyle = stdColor.css()
        borderAttr.lineWidth = thinLine
        switch (border.style) {
            case 'dashed':
                segments.push(dash)
                break
            case 'dashDot':
                segments.push(dash, dot)
                break
            case 'dashDotDot':
                segments.push(dash, dot, dot)
                break
            case 'dotted':
                segments.push(dot)
                break
            case 'hair':
                segments.push(hair)
                break
            case 'medium':
                borderAttr.lineWidth = mediumLine
                break
            case 'mediumDashed':
                borderAttr.lineWidth = mediumLine
                segments.push(dash)
                break
            case 'mediumDashDot':
                borderAttr.lineWidth = mediumLine
                segments.push(dash, dot)
                break
            case 'mediumDashDotDot':
                borderAttr.lineWidth = mediumLine
                segments.push(dash, dot, dot, dot)
                break
            case 'none':
                return
            case 'slantDashDot':
                this.restore()
                return
            case 'thick':
                borderAttr.lineWidth = thickLine
                break
            case 'thin':
                borderAttr.lineWidth = thinLine
                break
            default:
        }
        if (segments.length) this.setLineDash(segments)
        this.attr(borderAttr)
        const {startRow, startCol, endRow, endCol} = box.position
        const isDouble = border.style === 'double'
        switch (type) {
            case 'top':
                this.line([
                    [startCol, startRow],
                    [endCol, startRow],
                ])
                break
            case 'right':
                this.line([
                    [endCol, startRow],
                    [endCol, endRow],
                ])
                break
            case 'bottom':
                if (isDouble) {
                    this.line([
                        [startCol, endRow - 2],
                        [endCol, endRow - 2],
                    ])
                    this.line([
                        [startCol, endRow],
                        [endCol, endRow],
                    ])
                } else
                    this.line([
                        [startCol, endRow],
                        [endCol, endRow],
                    ])
                break
            case 'left':
                this.line([
                    [startCol, startRow],
                    [startCol, endRow],
                ])
                break
            default:
        }
        this.restore()
    }

    public text(txt: string, attr: TextAttr, box: Box): void {
        this.save()
        const textWidth = attr.font.measureText(txt).width
        const [tx, textAlign] = box.textX(attr.alignment?.horizontal)
        const [ty, textBaseAlign] = box.textY(attr.alignment?.vertical)
        const textAttr = new CanvasAttr()
        textAttr.textAlign = textAlign
        textAttr.textBaseAlign = textBaseAlign
        textAttr.font = attr.font
        this.attr(textAttr)
        /**
         * TODO(minglong): support multi lines txt
         */
        let trueTxt = txt
        if (textWidth > box.width) {
            let currText = ''
            let currWidth = 0
            for (let i = 0, txts = trueTxt.split(''); i < txts.length; i++) {
                const t = txts[i]
                const tWidth = attr.font.measureText(t).width
                if (currWidth + tWidth > box.width) break
                currText += t
                currWidth += tWidth
            }
            trueTxt = currText
        }
        this.fillText(trueTxt, tx, ty)
        this._underline(tx, ty, attr, textWidth)
        this.restore()
    }

    private _underline(
        tx: number,
        ty: number,
        attr: TextAttr,
        textWidth: number
    ) {
        let xOffset = 1
        let yOffset = 0
        const lineAttr = new CanvasAttr()
        lineAttr.strokeStyle = attr.font.standardColor.css()
        const horizontal = attr.alignment?.horizontal ?? 'general'
        const underline = attr.font.underline?.val ?? 'none'
        const vertical = attr.alignment?.vertical ?? 'center'
        switch (underline) {
            case 'double':
                break
            case 'none':
                return
            case 'single':
                lineAttr.lineWidth = npxLine(1)
                yOffset += attr.font.size / 2
                switch (vertical) {
                    case 'bottom':
                        yOffset += attr.font.size
                        break
                    case 'center':
                        yOffset += attr.font.size / 2
                        break
                    case 'top':
                        break
                    default:
                        yOffset += attr.font.size / 2
                        break
                }
                switch (horizontal) {
                    case 'general':
                    case 'center':
                        xOffset -= textWidth / 2
                        break
                    case 'right':
                        xOffset -= textWidth
                        break
                    case 'left':
                        break
                    default:
                        useToast().toast.error(
                            `Not support underline horizontal ${attr.alignment?.horizontal}`
                        )
                }
                this.attr(lineAttr)
                this.line([
                    [npx(tx + xOffset), npx(ty + yOffset)],
                    [npx(tx + textWidth + xOffset), npx(ty + yOffset)],
                ])
                break
            default:
                useToast().toast.error(
                    `Not support underline ${attr.font.underline}`
                )
                return
        }
    }
}
