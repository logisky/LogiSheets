import {upperCase} from '@/core/strings'
import formulas from '../../../resources/funcs/out/funcs.json'
import {formulaStandable} from '@/core/standable/formula'
export type Snippet = ReturnType<typeof getAllFormulas>[0]

const TMP_FLAG = '__LOGI_SHEETS_FORMULA_TMP_FLAG__'
const PARAM_SEP = ' , '
const PARAM_ELLIPSE = '...'
function allFormulas() {
    /**
     * TODO(minglong): wait for bazel and merge all function jsons to one json.
     */
    return formulas.map(formulaStandable)
}

export function isFormula(value: string) {
    const formula = value.trim()
    // normal formula
    if (formula.startsWith('='))
        return true
    // array formula
    if (formula.startsWith('{') && formula.endsWith('}')) {
        const f = formula.substr(1)
        return f.trim().startsWith('=')
    }
    return false
}
export function getAllFormulas() {
    return allFormulas().map(f => {
        const getTextUpperCase = () => {
            return upperCase(f.name)
        }
        const hasParams = () => {
            return f.argCount.eq !== 0 || f.argCount.ge !== 0 || f.argCount.le !== 0
        }
        /**
		 * 获取到第i个参数的message（包含第i个），返回message和第i个参数在message中的起始位置
		 * @param i 若i为-1，返回默认message
		 * @returns start为-1表示未匹配
		 */
        const getSnippetMessage = (i = -1): [snippetMessage: string, targetParam: { startIndex: number, endIndex: number }] => {
            let message = `${f.name}(`
            let targetParamIndex = i === -1 ? f.args.length : i
            const minParamCount = 3
            if (targetParamIndex < minParamCount)
                targetParamIndex = minParamCount
            const paramStrs: string[] = []
            let tmp = 0
            for (let j = 0; j < f.args.length; j++) {
                const arg = f.args[j]
                if (tmp > targetParamIndex)
                    break
                paramStrs.push(arg.argName)
                tmp++
                if (!arg.startRepeated)
                    continue
                let repeatCount = 1
                while (tmp <= targetParamIndex) {
                    paramStrs.push(`${arg.argName}${repeatCount}`)
                    repeatCount++
                    tmp++
                }
                paramStrs.push(PARAM_ELLIPSE)
            }
            let targetParam = ''
            if (paramStrs.length && i < paramStrs.length) {
                const targetIndex = i === -1 ? 0 : i
                targetParam = paramStrs[targetIndex]
                paramStrs[targetIndex] = `${TMP_FLAG}${paramStrs[targetIndex]}`
            }
            message += paramStrs.join(PARAM_SEP)
            message += ')'
            const startIndex = message.indexOf(TMP_FLAG)
            message = message.replace(TMP_FLAG, '')
            return [message, { startIndex, endIndex: startIndex + targetParam.length }]
        }
        const textEqual = (value: string) => {
            return getTextUpperCase() === upperCase(value)
        }
        return {
            ...f,
            getSnippetMessage,
            textEqual,
            hasParams,
        }
    })
}

export function fullFilterSnippet(key: string) {
    const formulas = getAllFormulas()
    return formulas.find(f => f.textEqual(key))
}
