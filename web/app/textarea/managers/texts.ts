import {Builder} from '@logi-base/src/ts/common/builder'
import {StandardFont} from '@logi-sheets/web/core/standable'
export interface Text {
    readonly char: string
    readonly font: StandardFont
    readonly isEof: boolean
    width(): number
}

class TextImpl implements Text {
    public char = ''
    public isEof = false
    public font = new StandardFont().setSize(14)
    width(): number {
        if (this.isEof)
            return 0
        const padding = 2
        return this.font.measureText(this.char).width + padding
    }
}

class TextBuilder extends Builder<Text, TextImpl> {
    public constructor(obj?: Readonly<Text>) {
        const impl = new TextImpl()
        if (obj)
            TextBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public char(str: string): this {
        this.getImpl().char = str
        return this
    }

    public isEof(isEof: boolean): this {
        this.getImpl().isEof = isEof
        return this
    }
}

export function isText(value: unknown): value is Text {
    return value instanceof TextImpl
}

export function assertIsText(value: unknown): asserts value is Text {
    if (!(value instanceof TextImpl))
        throw Error('Not a Text!')
}

export interface Texts {
    readonly texts: readonly Text[]
    add(texts: Texts, index: number): readonly Text[]
    remove(start: number, end: number): readonly Text[]
    replace(texts: Texts, start: number, end: number): readonly Text[]
    getPlainText(): string
}

class TextsImpl implements Texts {
    set texts(texts: readonly Text[]) {
        this._texts = texts.slice()
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

    replace(text: Texts, start: number, end: number): readonly Text[] {
        return this._texts.splice(start, end - start + 1, ...text.texts)
    }

    getPlainText(): string {
        let text = ''
        this.texts.forEach(t => text += t.char)
        return text
    }
    // tslint:disable-next-line: readonly-array
    private _texts: Text[] = []
}

export class TextsBuilder extends Builder<Texts, TextsImpl> {
    public constructor(obj?: Readonly<Texts>) {
        const impl = new TextsImpl()
        if (obj)
            TextsBuilder.shallowCopy(impl, obj)
        super(impl)
    }
    static from(content: string, eof: string): Texts {
        const texts = content
            .split('')
            .map(c => new TextBuilder().char(c).isEof(c === eof).build())
        return new TextsBuilder().texts(texts).build()
    }

    public texts(texts: readonly Text[]): this {
        this.getImpl().texts = texts
        return this
    }
}

export function isTexts(value: unknown): value is Texts {
    return value instanceof TextsImpl
}

export function assertIsTexts(value: unknown): asserts value is Texts {
    if (!(value instanceof TextsImpl))
        throw Error('Not a Texts!')
}
