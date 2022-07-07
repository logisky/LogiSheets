import { useEffect, useRef, useState } from 'react'
import {
    Candidate,
    SpanItem,
} from '@/components/suggest'
import { lcsLenMatch } from '@/common/algo/lcs'
import { fullFilterSnippet, getAllFormulas, isFormula, Snippet } from '@/core/snippet'
import { TextManager } from './text'
import { useCursor } from './cursor'
import { SubType, TokenType } from '@/core/formula'
import { KeyboardEventCode, StandardKeyboardEvent } from '@/common/events'
import { TokenManager } from './token'

export const useSuggest = <T,>(
    textMng: TextManager<T>,
    cursorMng: ReturnType<typeof useCursor>,
) => {
    const [showSuggest$, setShowSuggest] = useState(false)
    const [activeCandidate$, setActiveCandidate] = useState<Candidate>()
    const [candidates$, setCandidates] = useState<Candidate[]>([])
    const replaceRange = useRef<{ start: number, count: number }>()


    useEffect(() => {
        // 监听光标移动，高亮用户可能需要输入的内容
        onTrigger(textMng.getPlainText())
    }, [cursorMng.cursor$])

    const tokenMng = useRef(new TokenManager())

    const onType = () => {
        onTrigger(textMng.getPlainText())
    }
    const onKeydown = (e: StandardKeyboardEvent) => {
        if (!showSuggest$)
            return false
        if (e.keyCodeId === KeyboardEventCode.ARROW_UP) {
            if (!activeCandidate$) {
                setActiveCandidate(candidates$[0])
                return true
            }
            const currIndex = candidates$.findIndex(c => c === activeCandidate$)
            if (currIndex === -1)
                setActiveCandidate(candidates$[0])
            else
                setActiveCandidate(candidates$[currIndex === 0 ? 0 : currIndex - 1])
            return true
        } else if (e.keyCodeId === KeyboardEventCode.ARROW_DOWN) {
            if (!activeCandidate$) {
                setActiveCandidate(candidates$[0])
                return true
            }
            const currIndex = candidates$.findIndex(c => c === activeCandidate$)
            if (currIndex === -1)
                setActiveCandidate(candidates$[0])
            else
                setActiveCandidate(candidates$[currIndex === candidates$.length - 1 ? currIndex : currIndex + 1])
            return true
        } else if (e.keyCodeId === KeyboardEventCode.TAB) {
            e.e.preventDefault()
            if (activeCandidate$)
                onSuggest(activeCandidate$)
            return true
        }
        return false
    }

    const onTrigger = (text: string) => {
        if (!shouldShowSuggest(text)) {
            setShowSuggest(false)
            return
        }
        replaceRange.current = undefined
        const cursor = cursorMng.getCursorInOneLine()
        const tokenManager = tokenMng.current
        const tokenIndex = tokenManager.getTokenIndexByCursor(cursor, text)
        const token = tokenManager.getToken(tokenIndex)
        const newCandidates: Candidate[] = []
        if (!token) {
            setShowSuggest(false)
            return
        }
        // 如果当前光标停在function，则匹配function并提示
        if (tokenManager.isFunctionStart(token)) {
            const candidates = fuzzyFilterFormula(token.value)
            if (candidates.length === 0) {
                setShowSuggest(false)
                return
            }
            replaceRange.current = tokenManager.getTokenPosition(token)
            newCandidates.push(...candidates)
            // 如果光标停在参数位置或分隔符，计算当前属于第几个参数，提示该参数信息
        } else if (tokenManager.isOperandStart(token)) {
            const { fnIndex, paramCount } = tokenManager.getFnInfo(token)
            if (fnIndex === -1) {
                setShowSuggest(false)
                return
            }
            const fnName = tokenManager.getToken(fnIndex)?.value ?? ''
            const snippet = fullFilterSnippet(fnName)
            if (!snippet?.hasParams()) {
                setShowSuggest(false)
                return
            }
            let paramIndex = -1
            if (token.type === TokenType.OPERAND)
                paramIndex = paramCount === 0 ? 0 : paramCount - 1
            else if (token.subtype === SubType.START)
                paramIndex = 0
            else if (token.subtype === SubType.SEPARATOR)
                paramIndex = paramCount
            const candidate = getParamCandidate(text, snippet, paramIndex)
            newCandidates.push(...(candidate ? [candidate] : []))
        }
        if (newCandidates.length === 0) {
            setShowSuggest(false)
            return
        }
        setShowSuggest(true)
        setCandidates(newCandidates)
        setActiveCandidate(newCandidates[0])
    }
    const onSuggest = (candidate: Candidate) => {
        setShowSuggest(false)
        if (!replaceRange.current)
            return
        const {start, count} = replaceRange.current
        textMng.replace(candidate.plainText, start, count)
        // 将光标设到函数括号中间
        if (candidate.quoteStart) {
            const newCursor = start + candidate.quoteStart + 1
            cursorMng.setCursor(newCursor)
        }
    }


    return {
        onType,
        setShowSuggest,
        onKeydown,
        onSuggest,
        showSuggest$,
        candidates$,
        activeCandidate$,
    }
}
export interface ReplaceEvent {
	range: { start: number, end: number }
	text: string
}

function shouldShowSuggest(text: string) {
    return isFormula(text)
}
function getParamCandidate(triggerText: string, snippet: Snippet, paramIndex: number) {
    if (paramIndex === -1)
        return
    const candidate = new Candidate(triggerText)
    candidate.desc = snippet.getParamDescription(paramIndex)
    candidate.textOnly = true
    const [msg, { startIndex, endIndex }] = snippet.getSnippetMessage(paramIndex)
    const spans: SpanItem[] = []
    if (startIndex !== -1 && endIndex !== -1) {
        const startSpan = new SpanItem(msg.slice(0, startIndex))
        const highlightSpan = new SpanItem(msg.slice(startIndex, endIndex), true)
        const endSpan = new SpanItem(msg.slice(endIndex))
        spans.push(startSpan, highlightSpan, endSpan)
    } else
        spans.push(new SpanItem(msg))
    candidate.spans = spans
    return candidate
}


function fuzzyFilterFormula(key: string) {
    const result: Candidate[] = []
    const formulas = getAllFormulas()
    const lcsResult = lcsLenMatch(key, formulas, f => f.getText(), false)
    lcsResult.forEach(beMatchedInfo => {
        const quoteStart = beMatchedInfo.beMatched.getReplaceTextStartQuotePosition()
        const candidate = new Candidate(key, quoteStart, beMatchedInfo.beMatched.getReplacetext())
        candidate.desc = beMatchedInfo.beMatched.getDesc()
        const spans: SpanItem[] = []
        let currIndex = 0
        const snippetMessage = beMatchedInfo.beMatched.getText()
        beMatchedInfo.matchedMap.forEach(nameIndex => {
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
