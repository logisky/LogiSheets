import { Font, CtFontName, CtUnderlineProperty, Color } from '@/bindings'
import { shallowCopy } from '@/core'
import { StandardColor } from './color'
const DEFAULT_FONT_SIZE = 10
/**
 * https://developer.mozilla.org/zh-CN/docs/Web/CSS/font
 * css font: font-style | font-variant | font-weight | font-size | line-height | font-family
 *
 * font-family（字体族）: “Arial”、“Times New Roman”、“宋体”、“黑体”等;
 * font-style（字体样式）: normal（正常）、italic（斜体）或oblique（倾斜）;
 * font-variant (字体变化): normal（正常）或small-caps（小体大写字母）;
 * font-weight (字体浓淡): 是normal（正常）或bold（加粗）。有些浏览器甚至支持采用100到900之间的数字（以百为单位）;
 * font-size（字体大小）: 可通过多种不同单位（比如像素或百分比等）来设置, 如：12xp，12pt，120%，1em
 */
export type FontSizeUnit = 'px' | 'pt'
export class StandardFont implements Font {
    static from(font: Font): StandardFont {
        const f = new StandardFont()
        if (font.color === null)
            f.standardColor = StandardColor.from(0, 0, 0)
        else
            f.standardColor = StandardColor.fromCtColor(font.color)
        shallowCopy(font, f)
        // ooxml标准存的是pt
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
    underline: CtUnderlineProperty | null = null
    fontSizeUnit: FontSizeUnit = 'px'
    lineHeight = '100%'
    standardColor = StandardColor.from(0, 0, 0, 1)
    bold = false
    color!: Color
    family = null
    sz = 10
    condense = false
    italic = false
    outline = false
    shadow = false
    strike = false
    extend = false
    charset = null
    vertAlign = null
    scheme = null

    setSize(s: number) {
        this.sz = s
        return this
    }

    measureText (text: string): TextMetrics {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context)
            // tslint:disable-next-line: no-throw-unless-asserts
            throw Error('Can not get context from canvas')
        context.font = this.toCssFont()
        return context.measureText(text)
    }

    toCssFont (): string {
        const fontStyle = this.italic ? 'italic' : 'normal'
        const fontVariant = 'normal'
        const fontWeight = this.bold ? 'bold' : 'normal'
        const fontSize = `${this.size}${this.fontSizeUnit}`
        const fontFamily = this.name
        const lineHeight = this.lineHeight
        return `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize}/${lineHeight} ${fontFamily}`
    }
}
