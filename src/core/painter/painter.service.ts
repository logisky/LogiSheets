/* eslint-disable max-lines */
import {BorderPr, StPatternType} from 'logisheets-web'
import {StandardColor} from '@/core/standable'
import {CanvasAttr} from './canvas_attr'
import {Box} from './box'
import {CanvasApi} from './canvas'
import {useToast} from '@/ui/notification/useToast'

import {npx, npxLine, thinLineWidth} from './utils'
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

    /**
     * Fill a rounded rectangle inside the given box.
     * - color: CSS color string to fill
     * - box: target box
     * - radius: corner radius in CSS pixels
     * - inset: optional padding from box edges (applied on all sides)
     */
    fillRoundedBg(color: string, box: Box, radius: number, inset = 2) {
        this.save()
        const attr = new CanvasAttr()
        attr.fillStyle = color
        this.attr(attr)
        const {startRow: y, startCol: x} = box.position
        const w = Math.max(0, box.width - inset * 2)
        const h = Math.max(0, box.height - inset * 2)
        this.fillRoundedRect(x + inset, y + inset, w, h, radius)
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

    borderLine(
        border: BorderPr,
        horizontal: boolean,
        start: number,
        from: number,
        to: number
    ) {
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
        if (horizontal) {
            this.line([
                [from, start],
                [to, start],
            ])
        } else {
            this.line([
                [start, from],
                [start, to],
            ])
        }
        // After stroke, the lineDash will be reset
        this.setLineDash([])
        this.restore()
        return
    }

    /**
     * @returns Appropriate height of the text
     */
    public text(txt: string, attr: TextAttr, box: Box, render = true): number {
        if (txt === '') return 0
        this.save()
        const textWidth = attr.font.measureText(txt).width
        const [tx, textAlign] = box.textX(attr.alignment?.horizontal)
        const [ty, textBaseAlign] = box.textY(attr.alignment?.vertical)
        const textAttr = new CanvasAttr()
        textAttr.textAlign = textAlign
        textAttr.textBaseAlign = textBaseAlign
        textAttr.font = attr.font
        this.attr(textAttr)
        const lineHeight = attr.font.size * 1.3

        const shouldWrap =
            (textWidth > box.width && attr.alignment?.wrapText) ||
            /\r?\n/.test(txt) ||
            /\s/.test(txt)
        if (shouldWrap) {
            // TODO: Handle the wrap text with alignments.
            const paragraphs = txt.split(/\r?\n/)
            let currY = attr.font.size
            if (textBaseAlign === 'middle') {
                currY = currY - Math.max(0, Math.floor(attr.font.size * 0.1))
            }
            // Helper: segment string into grapheme clusters (fallback to code points)
            const segmentGraphemes = (s: string): string[] => {
                try {
                    type SegmentResult = {segment: string}
                    type SegmenterCtor = new (
                        locales?: string | string[] | undefined,
                        options?: {
                            granularity: 'grapheme' | 'word' | 'sentence'
                        }
                    ) => {segment(input: string): Iterable<SegmentResult>}
                    const maybeIntl = Intl as unknown as {
                        Segmenter?: SegmenterCtor
                    }
                    const Seg = maybeIntl.Segmenter
                    if (Seg) {
                        const seg = new Seg(undefined, {
                            granularity: 'grapheme',
                        })
                        const iterable = seg.segment(s)
                        return Array.from(iterable, (it) => it.segment)
                    }
                } catch (_) {
                    // ignore and use fallback
                }
                return Array.from(s)
            }

            for (let p = 0; p < paragraphs.length; p++) {
                const paragraph = paragraphs[p]
                const hasWhitespace = /\s/.test(paragraph)
                // If whitespace exists, keep it as separate tokens so we can wrap nicely at spaces.
                // Otherwise, fall back to grapheme clusters so CJK and emoji wrap correctly.
                const tokens = hasWhitespace
                    ? paragraph.split(/(\s+)/).filter((t) => t.length > 0)
                    : segmentGraphemes(paragraph)

                let line = ''
                for (let i = 0; i < tokens.length; i++) {
                    const token = tokens[i]
                    const testLine = line + token
                    const metrics = attr.font.measureText(testLine)
                    if (metrics.width > box.width && line !== '') {
                        // Flush current line
                        if (render) {
                            this.fillText(
                                line,
                                tx,
                                currY + box.position.startRow
                            )
                        }
                        const underlineWidth = attr.font.measureText(
                            line.trimEnd()
                        ).width
                        if (underlineWidth > 0 && render) {
                            this._underline(
                                tx,
                                currY + box.position.startRow,
                                attr,
                                underlineWidth
                            )
                        }
                        currY += lineHeight
                        // Start next line with current token (avoid leading whitespace)
                        line = hasWhitespace ? token.replace(/^\s+/, '') : token
                    } else {
                        line = testLine
                    }
                }
                // Draw the last line for this paragraph
                if (render) {
                    this.fillText(line, tx, currY + box.position.startRow)
                }
                const underlineWidth = attr.font.measureText(
                    line.trimEnd()
                ).width
                if (underlineWidth > 0 && render) {
                    this._underline(tx, currY, attr, underlineWidth)
                }
                currY += lineHeight
            }
            return currY
        } else {
            let trueTxt = txt
            if (textWidth > box.width) {
                let currText = ''
                let currWidth = 0
                for (
                    let i = 0, txts = trueTxt.split('');
                    i < txts.length;
                    i++
                ) {
                    const t = txts[i]
                    const tWidth = attr.font.measureText(t).width
                    if (currWidth + tWidth > box.width) break
                    currText += t
                    currWidth += tWidth
                }
                trueTxt = currText
            }
            let drawY = ty
            if (textBaseAlign === 'middle') {
                drawY = ty - Math.max(0, Math.floor(attr.font.size * 0.1))
            }
            if (render) {
                this.fillText(trueTxt, tx, drawY)
                this._underline(tx, ty, attr, textWidth)
            }
        }
        this.restore()
        return lineHeight
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
