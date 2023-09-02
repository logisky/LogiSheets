import {useEffect, useRef, useState} from 'react'
import {useLocalStore} from 'mobx-react'
import {Candidate, SpanItem, suggestStore} from '@/components/suggest'
import {lcsLenMatch} from '@/core/algo/lcs'
import {
    fullFilterSnippet,
    isFormula,
    Snippet,
    getAllFormulas,
} from '@/core/snippet'
import {getCursorInOneLine, useCursor} from './cursor'
import {SubType, TokenType} from '@/core/formula'
import {KeyboardEventCode, StandardKeyboardEvent} from '@/core/events'
import {TokenManager} from './token'
import { autorun } from 'mobx'
import { internalTextareaStore } from './store'

export const useSuggest = () => {
    const [activeCandidate$, setActiveCandidate] = useState<Candidate>()
    const store = useLocalStore(() => internalTextareaStore)
    const suggest = useLocalStore(() => suggestStore)
    const [candidates$, setCandidates] = useState<Candidate[]>([])
    const replaceRange = useRef<{start: number; count: number}>()

    useEffect(() => {
        autorun(() => {
            if (store.curosrColumn === -1 || store.cursorLineNumber === -1 || !store.showCursor) return
            // 监听光标移动，高亮用户可能需要输入的内容
            onType()
        })
    })

    const tokenMng = useRef(new TokenManager())

    const onType = () => {
        onTrigger(store.texts.getPlainText())
    }
    const onKeydown = (e: StandardKeyboardEvent) => {
        suggest.show = false
        if (e.keyCodeId === KeyboardEventCode.ARROW_UP) {
            if (!activeCandidate$) {
                setActiveCandidate(candidates$[0])
                return true
            }
            const currIndex = candidates$.findIndex(
                (c) => c === activeCandidate$
            )
            if (currIndex === -1) setActiveCandidate(candidates$[0])
            else
                setActiveCandidate(
                    candidates$[currIndex === 0 ? 0 : currIndex - 1]
                )
            return true
        } else if (e.keyCodeId === KeyboardEventCode.ARROW_DOWN) {
            if (!activeCandidate$) {
                setActiveCandidate(candidates$[0])
                return true
            }
            const currIndex = candidates$.findIndex(
                (c) => c === activeCandidate$
            )
            if (currIndex === -1) setActiveCandidate(candidates$[0])
            else
                setActiveCandidate(
                    candidates$[
                        currIndex === candidates$.length - 1
                            ? currIndex
                            : currIndex + 1
                    ]
                )
            return true
        } else if (e.keyCodeId === KeyboardEventCode.TAB) {
            e.e.preventDefault()
            if (activeCandidate$) onSuggest(activeCandidate$)
            return true
        }
        return false
    }

    const onTrigger = (text: string) => {
        if (!shouldShowSuggest(text)) {
            suggest.show =false
            return
        }
        replaceRange.current = undefined
        const cursor = getCursorInOneLine(store)
        const tokenManager = tokenMng.current
        const tokenIndex = tokenManager.getTokenIndexByCursor(cursor, text)
        const token = tokenManager.getToken(tokenIndex)
        const newCandidates: Candidate[] = []
        if (!token) {
            suggest.show = false
            return
        }
        // 如果当前光标停在function，则匹配function并提示
        if (tokenManager.isFunctionStart(token)) {
            const candidates = fuzzyFilterFormula(token.value)
            if (candidates.length === 0) {
                suggest.show = false
                return
            }
            replaceRange.current = tokenManager.getTokenPosition(token)
            newCandidates.push(...candidates)
            // 如果光标停在参数位置或分隔符，计算当前属于第几个参数，提示该参数信息
        } else if (tokenManager.isOperandStart(token)) {
            const {fnIndex, paramCount} = tokenManager.getFnInfo(token)
            if (fnIndex === -1) {
                suggest.show = false
                return
            }
            const fnName = tokenManager.getToken(fnIndex)?.value ?? ''
            const snippet = fullFilterSnippet(fnName)
            if (!snippet?.hasParams()) {
                suggest.show = false
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
            suggest.show = false
            return
        }
            suggest.show = true
        setCandidates(newCandidates)
        setActiveCandidate(newCandidates[0])
    }
    const onSuggest = (candidate: Candidate) => {
        suggest.show = false
        if (!replaceRange.current) return
        const {start, count} = replaceRange.current
        store.emit('suggest', {candidate, start, count})
    }
}
export interface ReplaceEvent {
    range: {start: number; end: number}
    text: string
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
