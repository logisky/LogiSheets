import { lowerCase } from "@/common/strings"

export class Candidate {
    constructor(
        public readonly triggerText: string,
        // 函数开始括号的位置,用于在suggest的时候把光标设到该位置
        public readonly quoteStart?: number,
        // 选择当前candidate之后，需要替换的文本
        public readonly plainText = '',
    ) { }
    // 无选择功能，仅做文本显示
    public textOnly = false
    public desc = ''
    public spans: readonly SpanItem[] = []
    public disable = false
    public get lowerCaseText(): string {
        return lowerCase(this.triggerText)
    }
}
export class SpanItem {
    constructor(
        public readonly text = '',
        public readonly highlight = false,
    ) { }
}
