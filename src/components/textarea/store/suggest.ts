import {action, computed, makeObservable, observable} from 'mobx'
import {TextareaStore} from './store'
import {Candidate, SpanItem} from '@/components/suggest'
import {lcsLenMatch} from '@/core/algo/lcs'
import {
    isFormula,
    Snippet,
    getAllFormulas,
    fullFilterSnippet,
} from '@/core/snippet'
import type {TokenUnit} from 'logisheets-web'

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
        if (_active >= this.candidates.length - 1)
            _active = this.candidates.length - 1
        this._activeCandidate = _active
    }
    @observable
    showSuggest = false

    @observable
    candidates: Candidate[] = []

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
    private replaceRange?: {start: number; count: number}

    @action
    public onTrigger(text: string, tokenUnits: readonly TokenUnit[]) {
        if (!shouldShowSuggest(text)) {
            this.showSuggest = false
            return
        }
        this.replaceRange = undefined
        const cursor = this.store.cursor.cursorPosition
        const triggerContext = getTriggerContext(text, tokenUnits, cursor)
        if (!triggerContext) {
            this.showSuggest = false
            return
        }
        const newCandidates: Candidate[] = []
        if (triggerContext.func === '' && triggerContext.argIndex === -1) {
            const candidates = fuzzyFilterFormula(triggerContext.text)
            if (candidates.length === 0) {
                this.showSuggest = false
                return
            }
            this.replaceRange = {
                start: triggerContext.start,
                count: triggerContext.end - triggerContext.start,
            }
            newCandidates.push(...candidates)
        } else if (triggerContext.argIndex !== -1) {
            const snippet = fullFilterSnippet(triggerContext.func)
            if (!snippet?.hasParams()) {
                this.showSuggest = false
                return
            }
            const candidate = getParamCandidate(
                text,
                snippet,
                triggerContext.argIndex
            )
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

function getTriggerContext(
    text: string,
    tokenUnits: readonly TokenUnit[],
    cursor: number
): TriggerContext | undefined {
    if (cursor === 0) return
    let argIdx = -1
    let funcName = ''
    let lastUnitEnd = 0
    const offset = 1
    for (const unit of tokenUnits) {
        const start = unit.start + offset
        const end = unit.end + offset
        if (end < lastUnitEnd) continue

        if (unit.tokenType === 'funcName') {
            funcName = text.slice(start, end)
            argIdx = -1
        }
        if (unit.tokenType === 'funcArg') {
            // If the current cursor is greater than the end of the argument,
            // skip to the end
            if (cursor >= end) {
                argIdx++
                lastUnitEnd = end
            }
            continue
        }
        if (cursor <= start)
            return {
                text: text.slice(lastUnitEnd, start),
                func: funcName,
                argIndex: argIdx,
                start: lastUnitEnd,
                end: start,
            }
        if (cursor > end) {
            lastUnitEnd = end
            continue
        }

        if (unit.tokenType === 'funcName') {
            return {
                text: funcName,
                func: '',
                argIndex: -1,
                start: start,
                end: end,
            }
        }
    }
    return {
        text: text.slice(lastUnitEnd, text.length),
        func: funcName,
        argIndex: argIdx,
        start: lastUnitEnd,
        end: text.length,
    }
}

interface TriggerContext {
    text: string
    func: string
    argIndex: number
    start: number
    end: number
}
