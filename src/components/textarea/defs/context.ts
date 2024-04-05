export class Context<T = any> {
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
}

export interface ITextareaInstance {
    focus: () => void
}