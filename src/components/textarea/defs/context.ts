import {Position} from '../input'
export class Context<T> {
    public text = ''
    public eof = '\n'
    public cellWidth = 0
    public cellHeight = 0
    public clientX = 0
    public clientY = 0
    public canvasOffsetX = 0
    public canvasOffsetY = 0
    /**
     * -1 means in the end
     */
    public textareaOffsetX = 0
    /**
     * -1 means in the end
     */
    public textareaOffsetY = 0
    public bindingData?: T
    lineHeight(): number {
        return this.cellHeight
    }

    getOffset(
        x: number,
        y: number
    ): readonly [offsetX: number, offsetY: number] {
        return [x - this.clientX, y - this.clientY]
    }

    getTexts(
        startPosition?: Position,
        endPosition?: Position
    ): readonly string[] {
        const texts = this.text.split(this.eof)
        const start = startPosition ?? new Position()
        const endLine = texts.length - 1
        const endCol = texts[endLine].length - 1
        let end = endPosition
        if (!end) {
            end = new Position()
            end.lineNumber = endLine
            end.column = endCol
        }
        if (start.lineNumber === end.lineNumber)
            return [texts[start.lineNumber].slice(start.column, end.column + 1)]
        const r: string[] = []
        for (let i = start.lineNumber; i <= end.lineNumber; i += 1)
            if (i === start.lineNumber) r.push(texts[i].slice(start.column))
            else if (i === end.lineNumber)
                r.push(texts[i].slice(0, end.column + 1))
            else r.push(texts[i])
        return r
    }
}
