import {StandardFont} from '@/core/standable'
export class Text {
    public char = ''
    public isEof = false
    public font = new StandardFont().setSize(14)
    width(): number {
        if (this.isEof) return 0
        const padding = 2
        return this.font.measureText(this.char).width + padding
    }
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
