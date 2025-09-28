import {StandardFont} from '@/core/standable'
export class Text {
    public char = ''
    public isEof = false
    public font = new StandardFont().setSize(14)
    width(): number {
        if (this.isEof) return 0
        return Text.measureText(this.char, this.font.toCssFont()).width
    }

    static measureText(text: string, font: string): TextMetrics {
        const dpr = window.devicePixelRatio || 1

        const hasDocument =
            typeof document !== 'undefined' &&
            typeof document.createElement === 'function'
        // Use cached canvas context for better performance
        if (!Text._canvasContext) {
            if (hasDocument) {
                const canvas = document.createElement('canvas')
                canvas.width = 100 * dpr
                canvas.height = 100 * dpr
                Text._canvasContext = canvas.getContext('2d')
            } else {
                Text._canvasContext = new OffscreenCanvas(100, 100).getContext(
                    '2d'
                )
            }
            // Exactly match main canvas setup for consistent measurement
            if (Text._canvasContext) {
                Text._canvasContext.scale(dpr, dpr)
            }
        }
        if (!Text._canvasContext) return {width: text.length * 8} as TextMetrics

        Text._canvasContext.font = font
        const metrics = Text._canvasContext.measureText(text)

        // With DPR scaling, measureText returns scaled width, divide by DPR for CSS pixels
        return {
            ...metrics,
            width: metrics.width,
        }
    }

    private static _canvasContext:
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null = null
}

export class Texts {
    constructor(texts: Text[] = []) {
        this._texts = texts
    }
    static from(content: string, eof: string): Texts {
        const texts = content.split('').map((c) => {
            const t = new Text()
            t.char = c
            t.isEof = c === eof
            return t
        })
        return new Texts(texts)
    }

    get texts(): readonly Text[] {
        return this._texts
    }

    add(texts: Texts, index: number): readonly Text[] {
        this._texts.splice(index, 0, ...texts.texts)
        return texts.texts
    }

    remove(start: number, end: number): readonly Text[] {
        return this._texts.splice(start, end - start + 1)
    }

    replace(text: Texts, start: number, count: number): readonly Text[] {
        return this._texts.splice(start, count, ...text.texts)
    }

    getPlainText(): string {
        let text = ''
        this._texts.forEach((t) => (text += t.char))
        return text
    }
    private _texts: Text[] = []
}
