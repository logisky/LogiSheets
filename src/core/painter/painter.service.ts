import { BorderPr, StPatternType } from '@/bindings'
import { StandardColor } from '@/core/standable'
import { CanvasAttr } from './canvas_attr'
import { Box } from './box'
import { CanvasApi } from './canvas'

import { npx, npxLine, thinLineWidth } from './utils'
import { Direction } from '@/common'
import { TextAttr } from './text_attr'

export class PainterService extends CanvasApi {
    fillFgColor (type: StPatternType, color: string, box: Box) {
        this.save()
        const attr = new CanvasAttr()
        attr.fillStyle = color
        this.attr(attr)
        switch (type) {
        case 'Solid': {
            const { startRow: y, startCol: x } = box.position
            this.fillRect(x, y, box.width, box.height)
        }
            break
        default:
        }
        this.restore()
    }

    comment (box: Box): void {
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

    // tslint:disable-next-line: max-func-body-length
    border (border: BorderPr, box: Box, type: Direction) {
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
        case 'Dashed':
            segments.push(dash)
            break
        case 'DashDot':
            segments.push(dash, dot)
            break
        case 'DashDotDot':
            segments.push(dash, dot, dot)
            break
        case 'Dotted':
            segments.push(dot)
            break
        case 'Double':
            return
        case 'Hair':
            segments.push(hair)
            break
        case 'Medium':
            borderAttr.lineWidth = mediumLine
            break
        case 'MediumDashed':
            borderAttr.lineWidth = mediumLine
            segments.push(dash)
            break
        case 'MediumDashDot':
            borderAttr.lineWidth = mediumLine
            segments.push(dash, dot)
            break
        case 'MediumDashDotDot':
            borderAttr.lineWidth = mediumLine
            segments.push(dash, dot, dot, dot)
            break
        case 'None':
            return
        case 'SlantDashDot':
            this.restore()
            return
        case 'Thick':
            borderAttr.lineWidth = thickLine
            break
        case 'Thin':
            borderAttr.lineWidth = thinLine
            break
        default:
        }
        if (segments.length)
            this.setLineDash(segments)
        this.attr(borderAttr)
        const { startRow, startCol, endRow, endCol } = box.position
        switch (type) {
        case 'top':
            this.line([[startCol, startRow], [endCol, startRow]])
            break
        case 'right':
            this.line([[endCol, startRow], [endCol, endRow]])
            break
        case 'bottom':
            this.line([[startCol, endRow], [endCol, endRow]])
            break
        case 'left':
            this.line([[startCol, startRow], [startCol, endRow]])
            break
        default:
        }
        this.restore()
    }

    public text (txt: string, attr: TextAttr, box: Box): void {
        this.save()
        const boxWidth = box.width
        const ntxts: string[] = []
        const txts = txt.split('\n')
        txts.forEach(it => {
            const width = attr.font.measureText(it).width
            if (width < boxWidth) {
                ntxts.push(it)
                return
            }
            let each = ''
            it.split('').forEach(t => {
                const width = attr.font.measureText(each + t).width
                if (width >= boxWidth) {
                    ntxts.push(each)
                    each = ''
                    return
                }
                each += t
            })
            if (each !== '')
                ntxts.push(each)
        })
        const [tx, textAlign] = box.textX(attr.alignment?.horizontal)
        const [ty, textBaseAlign] = box.textY(attr.alignment?.vertical)
        let yOffset = 0
        const textAttr = new CanvasAttr()
        textAttr.textAlign = textAlign
        textAttr.textBaseAlign = textBaseAlign
        textAttr.font = attr.font
        ntxts.forEach((it, i) => {
            if (it === '')
                return
            if (i !== 0)
                return
            this.attr(textAttr)
            this.fillText(it, tx, ty + yOffset)
            this.save()
            this._underline(tx, ty + yOffset, attr, it)
            this.restore()
            yOffset += attr.font.size + 2
        })
        this.restore()
    }

    private _underline (tx: number, ty: number, attr: TextAttr, text: string) {
        let xOffset = 1
        let yOffset = 1
        const lineAttr = new CanvasAttr()
        lineAttr.strokeStyle = attr.font.standardColor.css()
        const width = attr.font.measureText(text).width
        switch (attr?.font?.underline?.val ?? 'None') {
        case 'DoubleAccounting':
        case 'Double':
        case 'None':
            return
        case 'Single':
            lineAttr.lineWidth = npxLine(1)
            switch (attr.alignment?.vertical) {
            case 'Bottom':
                yOffset += attr.font.size / 2
                break
            case 'Center':
                break
            case 'Top':
                break
            default:
                yOffset += attr.font.size / 2
                break
            }
            switch (attr.alignment?.horizontal) {
            case 'Center':
                xOffset -= (width / 2)
                break
            case 'Right':
                xOffset += -width
                break
            case 'Left':
                break
            default:
                console.log(`Not support underline horizontal ${attr.alignment?.horizontal}`)
            }
            break
        default:
            console.error(`Not support underline ${attr.font.underline}`)
            return
        }
        this.attr(lineAttr)
        this.line([
            [tx + npx(xOffset), ty + npx(yOffset)],
            [tx + npx(xOffset) + width, ty + npx(yOffset)]])
    }
}
