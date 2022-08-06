import {
    getParentScrollTop,
    restoreParentsScrollTop,
    getShadowRoot,
} from '@/core/document'
export class TextAreaWrapper {
    constructor(
        public readonly textArea: HTMLTextAreaElement,
    ) { }
    setIgnoreSelectionChangeTime(): void {
        this._ignoreSelectionChangeTime = Date.now()
    }

    getIgnoreSelectionChangeTime(): number {
        return this._ignoreSelectionChangeTime
    }

    resetSelectionChangeTime(): void {
        this._ignoreSelectionChangeTime = 0
    }

    getValue(): string {
        return this.textArea.value
    }

    setValue(value: string): void {
        if (this.textArea.value === value)
            return
        this.setIgnoreSelectionChangeTime()
        this.textArea.value = value
    }

    getSelectionStart(): number {
        return this.textArea.selectionDirection === 'backward' ? this.textArea.selectionEnd : this.textArea.selectionStart
    }

    getSelectionEnd(): number {
        return this.textArea.selectionDirection === 'backward' ? this.textArea.selectionStart : this.textArea.selectionEnd
    }

    setSelectionRange(start: number, end: number): void {
        const shadowRoot = getShadowRoot(this.textArea)
        const activeElement = shadowRoot ? shadowRoot.activeElement : document.activeElement
        const isFocused = activeElement === this.textArea
        if (isFocused && this.textArea.selectionStart === start && this.textArea.selectionEnd === end)
            return
        if (isFocused) {
            this.setIgnoreSelectionChangeTime()
            this.textArea.setSelectionRange(start, end)
            return
        }
        const scrollState = getParentScrollTop(this.textArea)
        this.setIgnoreSelectionChangeTime()
        this.textArea.focus()
        this.textArea.setSelectionRange(start, end)
        restoreParentsScrollTop(this.textArea, scrollState)
    }
    private _ignoreSelectionChangeTime = 0
}
