import { action, computed, makeObservable, observable } from "mobx";
import { TextareaStore } from "./store";
import { Candidate, SpanItem } from "@/components/suggest";
import { lcsLenMatch } from "@/core/algo/lcs";
import { isFormula, Snippet, getAllFormulas, fullFilterSnippet } from "@/core/snippet";
import { TokenType, SubType } from "@/core/formula";
import { TokenManager } from "./token";

export class Suggest {
    constructor(public readonly store: TextareaStore) {
        makeObservable(this)
    }
    @computed
    get activeCandidate() {
        return this._activeCandidate
    }

    set activeCandidate(active: number) {
        let _active = active
        if (_active < 0) _active = 0
        if (_active >= this.candidates.length - 1) _active = this.candidates.length - 1
        this._activeCandidate = _active
    }
    @observable
    showSuggest = false

    @observable
    candidates: Candidate[] = []


    @action
    onType ()  {
        this.onTrigger(this.store.textManager.getPlainText())
    }

    @action
    onSuggest = (active: number = this._activeCandidate) => {
        this.showSuggest = false
        if (!this.replaceRange) return
        const {start, count} = this.replaceRange
        const candidate = this.candidates[active]
        this.store.textManager.replace(candidate.plainText, start, count)
        // set cursor between brace
        if (candidate.quoteStart) {
            const newCursor = start + candidate.quoteStart + 1
            this.store.cursor.updatePosition(newCursor)
        }
    }

    @observable
    private _activeCandidate = -1
    private _tokenManager = new TokenManager()
    private replaceRange?: {start: number; count: number}

    @action
    private onTrigger (text: string) {
        if (!shouldShowSuggest(text)) {
            this.showSuggest = false
            return
        }
        this.replaceRange = undefined
        const cursor = this.store.cursor.cursorPosition
        const tokenIndex = this._tokenManager.getTokenIndexByCursor(cursor, text)
        const token = this._tokenManager.getToken(tokenIndex)
        const newCandidates: Candidate[] = []
        if (!token) {
            this.showSuggest = false
            return
        }
        // 如果当前光标停在function，则匹配function并提示
        if (this._tokenManager.isFunctionStart(token)) {
            const candidates = fuzzyFilterFormula(token.value)
            if (candidates.length === 0) {
            this.showSuggest = false
                return
            }
            this.replaceRange = this._tokenManager.getTokenPosition(token)
            newCandidates.push(...candidates)
            // 如果光标停在参数位置或分隔符，计算当前属于第几个参数，提示该参数信息
        } else if (this._tokenManager.isOperandStart(token)) {
            const {fnIndex, paramCount} = this._tokenManager.getFnInfo(token)
            if (fnIndex === -1) {
                this.showSuggest = false
                return
            }
            const fnName = this._tokenManager.getToken(fnIndex)?.value ?? ''
            const snippet = fullFilterSnippet(fnName)
            if (!snippet?.hasParams()) {
                this.showSuggest = false
                return
            }
            let paramIndex = -1
            if (token.type === TokenType.OPERAND)
                paramIndex = paramCount === 0 ? 0 : paramCount - 1
            else if (token.subtype === SubType.START) paramIndex = -1
            else if (token.subtype === SubType.SEPARATOR)
                paramIndex = paramCount
            const candidate = getParamCandidate(text, snippet, paramIndex)
            newCandidates.push(...(candidate ? [candidate] : []))
        }
        if (newCandidates.length === 0) {
                this.showSuggest = false
            return
        }
        this.showSuggest = true
        this.candidates = newCandidates
        this.activeCandidate = 0
    }
}

function shouldShowSuggest(text: string) {
    return isFormula(text)
}
function getParamCandidate(
    triggerText: string,
    snippet: Snippet,
    paramIndex: number
) {
    const candidate = new Candidate(triggerText)
    candidate.desc = snippet.args.at(paramIndex)?.description ?? ''
    candidate.textOnly = true
    const [msg, {startIndex, endIndex}] = snippet.getSnippetMessage(paramIndex)
    const spans: SpanItem[] = []
    if (startIndex !== -1 && endIndex !== -1) {
        const startSpan = new SpanItem(msg.slice(0, startIndex))
        const highlightSpan = new SpanItem(
            msg.slice(startIndex, endIndex),
            true
        )
        const endSpan = new SpanItem(msg.slice(endIndex))
        spans.push(startSpan, highlightSpan, endSpan)
    } else spans.push(new SpanItem(msg))
    candidate.spans = spans
    return candidate
}

function fuzzyFilterFormula(key: string) {
    const result: Candidate[] = []
    const formulas = getAllFormulas()
    const lcsResult = lcsLenMatch(key, formulas, (f) => f.name, false)
    lcsResult.forEach((beMatchedInfo) => {
        const quoteStart = beMatchedInfo.beMatched.name.length
        const candidate = new Candidate(
            key,
            quoteStart,
            `${beMatchedInfo.beMatched.name}()`
        )
        candidate.desc = beMatchedInfo.beMatched.description
        const spans: SpanItem[] = []
        let currIndex = 0
        const snippetMessage = beMatchedInfo.beMatched.name
        beMatchedInfo.matchedMap.forEach((nameIndex) => {
            const nameSlice = snippetMessage.slice(currIndex, nameIndex)
            if (nameSlice !== '') {
                const normalSpan = new SpanItem(nameSlice)
                spans.push(normalSpan)
            }
            const highlightSlice = snippetMessage.substr(nameIndex, 1)
            const highlightSpan = new SpanItem(highlightSlice, true)
            spans.push(highlightSpan)
            currIndex = nameIndex + highlightSlice.length
        })
        const lastSlice = snippetMessage.substr(currIndex)
        if (lastSlice !== '') {
            const lastSpan = new SpanItem(lastSlice)
            spans.push(lastSpan)
        }
        candidate.spans = spans
        result.push(candidate)
    })
    return result
}
