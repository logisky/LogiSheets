import {Font, CtFontName, CtUnderlineProperty, Color} from 'logisheets-web'
import {shallowCopy} from '@/core'
import {StandardColor} from './color'
import {Text} from '@/components/textarea/defs'
const DEFAULT_FONT_SIZE = 10
/**
 * https://developer.mozilla.org/en-US/docs/Web/CSS/font
 * CSS font: font-style | font-variant | font-weight | font-size | line-height | font-family
 *
 * font-family: Specifies the typeface, such as "Arial," "Times New Roman," "SimSun," or "SimHei."
 * font-style: Defines the style of the font, such as normal (default), italic, or oblique.
 * font-variant: Controls text transformation; options include normal (default) or small-caps (small uppercase letters).
 * font-weight: Specifies the weight (thickness) of the font, such as normal (default) or bold. Some browsers support numeric values ranging from 100 to 900 in increments of 100.
 * font-size: Defines the size of the font, which can be set using various units like pixels, points, percentages, or relative units such as em. Examples: 12px, 12pt, 120%, 1em.
 */

export type FontSizeUnit = 'px' | 'pt'
export class StandardFont implements Font {
    static from(font: Font): StandardFont {
        const f = new StandardFont()
        if (font.color === null) f.standardColor = StandardColor.from(0, 0, 0)
        else f.standardColor = StandardColor.fromCtColor(font.color)
        shallowCopy(font, f)
        f.fontSizeUnit = 'pt'
        if (font.sz === 0) {
            f.fontSizeUnit = 'px'
            f.sz = DEFAULT_FONT_SIZE
        }
        return f
    }
    get size() {
        return this.sz
    }

    name: CtFontName = {val: 'Arial'}
    underline?: CtUnderlineProperty
    fontSizeUnit: FontSizeUnit = 'px'
    lineHeight = '100%'
    standardColor = StandardColor.from(0, 0, 0, 1)
    bold = false
    color!: Color
    sz = 10
    condense = false
    italic = false
    outline = false
    shadow = false
    strike = false
    extend = false

    setSize(s: number) {
        this.sz = s
        return this
    }

    measureText(text: string): TextMetrics {
        return Text.measureText(text, this.toCssFont())
    }

    toCssFont(): string {
        const fontStyle = this.italic ? 'italic' : 'normal'
        const fontVariant = 'normal'
        const fontWeight = this.bold ? 'bold' : 'normal'
        const fontSize = `${this.size}${this.fontSizeUnit}`
        const fontFamily = this.name
        const lineHeight = this.lineHeight
        const result = `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize}/${lineHeight} ${fontFamily.val}`
        return result
    }
}
