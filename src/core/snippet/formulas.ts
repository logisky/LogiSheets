import { lowerCase, upperCase } from '@/common/strings'
import Formulas from './formula.json'

export type Formula = ReturnType<typeof allFormulas>[0]
export type ParamDesc = Formula['paramDesc']
export type Param = ParamDesc['params'][0]
export type Snippet = ReturnType<typeof getAllFormulas>[0]

function allFormulas() {
    return Formulas
}

export function isFormula(value: string) {
    const formula = value.trim()
    // 普通公式
    if (formula.startsWith('='))
        return true
    // 数组公式
    if (formula.startsWith('{') && formula.endsWith('}')) {
        const f = formula.substr(1)
        return f.trim().startsWith('=')
    }
    return false
}
export function getAllFormulas() {
    return allFormulas().map(f => {
        const getText = () => {
            return f.textLabel ?? ''
        }
        const getTextLowerCase = () => {
            return lowerCase(getText())
        }
        const getTextUpperCase = () => {
            return upperCase(getText())
        }
        const getDesc = () => {
            return f.desc ?? ''
        }
        const getParamDesc = (): ParamDesc | undefined => {
            return f.paramDesc
        }
        const getParamDescription = (i: number) => {
            const param = getParam(i)
            return param?.desc ?? ''
        }
        const getParams = () => {
            return getParamDesc()?.params ?? []
        }
        const hasParams = () => {
            return getParams().length !== 0
        }
        const getParam = (i: number): Param | undefined => {
            const params = getParams()
            return params[i]
        }
        const getParamType = (i: number) => {
            return getParam(i)?.type ?? ''
        }
        const getParamTypes = (): readonly string[] => {
            return getParams().map((_, i) => getParamType(i))
        }
        const getReplacetext = () => {
            return `${getText()}()`
        }
        const getReplaceTextStartQuotePosition = () => {
            return getReplacetext().indexOf('(')
        }
        /**
		 * 获取到第i个参数的message（包含第i个），返回message和第i个参数在message中的起始位置
		 * @param i 若i为-1，返回默认message
		 * @returns start为-1表示未匹配
		 */
        const getSnippetMessage = (i = -1): [snippetMessage: string, targetParam: { startIndex: number, endIndex: number }] => {
            const fn = getText()
            const paramDesc = getParamDesc()
            const params = getParamTypes()
            let message = `${fn}(`
            const tmpSplitter = '__LOGI_SHEETS_INTERNAL_SPLITTER__'
            const paramSeparator = ' , '
            const paramEllipse = '...'
            let targetParam = ''
            if (params.length !== 0) {
                const paramStrs: string[] = []
                // get params until index is i
                if (paramDesc?.count === -1) {
                    if (i === -1)
                        paramStrs.push(...params.slice(0, 3))
                    else {
                        const showingParams = i >= params.length ? params
                            : params.slice(0, i).concat([tmpSplitter + params[i]])
                        paramStrs.push(...showingParams)
                        targetParam = params[i]
                    }
                    paramStrs.push(paramEllipse)
                    // get all params
                } else {
                    if (i === -1) {
                        paramStrs.push(...params)
                    } else {
                        const showingParams = i >= params.length ? params :
                            params.slice(0, i).concat([tmpSplitter + params[i]], params.slice(i + 1))
                        paramStrs.push(...showingParams)
                        targetParam = params[i]
                    }
                }
                message += paramStrs.join(paramSeparator)
                message += ')'
            }
            const startIndex = message.indexOf(tmpSplitter)
            let endIndex = -1
            if (startIndex !== -1) {
                message = message.slice(0, startIndex) + message.slice(startIndex + tmpSplitter.length)
                endIndex = startIndex + targetParam.length
            }
            return [message, { startIndex, endIndex }]
        }
        const textEqual = (value: string) => {
            return getTextUpperCase() === upperCase(value)
        }
        return {
            getDesc,
            getParam,
            getParamDesc,
            getParamDescription,
            getParamType,
            getParams,
            getReplacetext,
            getSnippetMessage,
            getText,
            getTextLowerCase,
            getTextUpperCase,
            getReplaceTextStartQuotePosition,
            hasParams,
            textEqual,
        }
    })
}

export function fullFilterSnippet(key: string) {
    const formulas = getAllFormulas()
    return formulas.find(f => f.textEqual(key))
}
