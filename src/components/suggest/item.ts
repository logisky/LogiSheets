import {lowerCase} from '@/core/strings'

export class Candidate {
    constructor(
        public readonly triggerText: string,
        public readonly quoteStart?: number,
        public readonly plainText = ''
    ) {}
    public textOnly = false
    public desc = ''
    public spans: readonly SpanItem[] = []
    public disable = false
    public get lowerCaseText(): string {
        return lowerCase(this.triggerText)
    }
}
export class SpanItem {
    constructor(public readonly text = '', public readonly highlight = false) {}
}
