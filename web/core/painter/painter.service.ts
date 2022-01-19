// tslint:disable: max-params
import {
    BorderPr,
    BorderTypeEnum,
    UnderlineTypeEnum,
    Alignment_HorizontalEnum as AlignX,
    Alignment_VerticalEnum as AlignY,
    PatternFillTypeEnum,
} from '@logi-pb/network/src/proto/message_pb'
import {StandardColor} from '@logi-sheets/web/core/standable'
import {CanvasAttrBuilder} from './canvas_attr'
import {Box} from './box'
import {CanvasApi} from './canvas'

import {npx, npxLine, thinLineWidth} from './utils'
import {Direction, error} from '@logi-sheets/web/global'
import {TextAttr} from './text_attr'

export class PainterService extends CanvasApi {
    fillFgColor(type: PatternFillTypeEnum, color: string, box: Box) {
        this.save()
        const attr = new CanvasAttrBuilder().fillStyle(color).build()
        this.attr(attr)
        switch(type) {
        case PatternFillTypeEnum.SOLID: {
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
        const attr = new CanvasAttrBuilder().fillStyle('red').build()
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
    border(border: BorderPr, box: Box, type: Direction) {
        this.save()
        const stdColor = StandardColor.fromArgb(border.color)
        const dot = npx(1)
        const hair = dot / 2
        const dash = npx(3)
        const thinLine = thinLineWidth()
        const mediumLine = npx(2) - 0.5
        const thickLine = npx(3)
        const segments = []
        const borderAttr = new CanvasAttrBuilder()
            .strokeStyle(stdColor.css())
            .lineWidth(thinLine)
        switch(border.type) {
        case BorderTypeEnum.DASHED:
            segments.push(dash)
            break
        case BorderTypeEnum.DASH_DOT:
            segments.push(dash, dot)
            break
        case BorderTypeEnum.DASH_DOT_DOT:
            segments.push(dash, dot, dot)
            break
        case BorderTypeEnum.DOTTED:
            segments.push(dot)
            break
        case BorderTypeEnum.DOUBLE:
            return
        case BorderTypeEnum.HAIR:
            segments.push(hair)
            break
        case BorderTypeEnum.MEDIUM:
            borderAttr.lineWidth(mediumLine)
            break
        case BorderTypeEnum.MEDIUM_DASHED:
            borderAttr.lineWidth(mediumLine)
            segments.push(dash)
            break
        case BorderTypeEnum.MEDIUM_DASH_DOT:
            borderAttr.lineWidth(mediumLine)
            segments.push(dash, dot)
            break
        case BorderTypeEnum.MEDIUM_DASH_DOT_DOT:
            borderAttr.lineWidth(mediumLine)
            segments.push(dash, dot, dot, dot)
            break
        case BorderTypeEnum.NONE_BORDER:
            return
        case BorderTypeEnum.SLANT_DASH_DOT:
            this.restore()
            return
        case BorderTypeEnum.THICK:
            borderAttr.lineWidth(thickLine)
            break
        case BorderTypeEnum.THIN:
            borderAttr.lineWidth(thinLine)
            break
        default:
        }
        if (segments.length)
            this.setLineDash(segments)
        this.attr(borderAttr.build())
        const {startRow, startCol, endRow, endCol} = box.position
        switch(type) {
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

    public text(txt: string, attr: TextAttr, box: Box): void {
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
        const [tx, textAlign] = box.textX(attr.alignment.horizontal)
        const [ty, textBaseAlign] = box.textY(attr.alignment.vertical)
        let yOffset = 0
        const textAttr = new CanvasAttrBuilder()
            .textAlign(textAlign)
            .textBaseAlign(textBaseAlign)
            .font(attr.font)
            .build()
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

    private _underline(tx: number, ty: number, attr: TextAttr, text: string) {
        let xOffset = 1
        let yOffset = 1
        const lineAttr = new CanvasAttrBuilder()
            .strokeStyle(attr.font.standardColor.css())
        const width = attr.font.measureText(text).width
        switch(attr.font.underline) {
        case UnderlineTypeEnum.DOUBLE_ACCOUNTING:
            break
        case UnderlineTypeEnum.DOUBLE_U:
            break
        case UnderlineTypeEnum.NONE:
            return
        case UnderlineTypeEnum.SINGLE:
            lineAttr.lineWidth(npxLine(1))
            switch(attr.alignment.vertical) {
            case AlignY.V_BOTTOM:
                yOffset = 0
                break
            case AlignY.V_CENTER:
                break
            case AlignY.V_TOP:
                break
            case AlignY.V_UNSPECIFIED:
                yOffset += attr.font.size / 2
                break
            default:
            }
            switch(attr.alignment.horizontal) {
            case AlignX.H_CENTER:
                xOffset += 0
                break
            case AlignX.H_RIGHT:
                xOffset += -width
                break
            case AlignX.H_LEFT:
                break
            }
            break
        default:
            error(`Not support underline ${attr.font.underline}`)
            return
        }
        this.attr(lineAttr.build())
        this.line([
            [tx + npx(xOffset), ty + npx(yOffset)],
            [tx + npx(xOffset) + width, ty + npx(yOffset)]],)
    }
}
