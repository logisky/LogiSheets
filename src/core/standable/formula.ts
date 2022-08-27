import {shallowCopy} from '@/core/clone'

/**
 * @see /resources/funcs/README.md
 */
export interface Formula {
    readonly name: string
    readonly argCount: ArgCount
    readonly args: Arg[]
    readonly description: string
}
class FormulaImpl implements Formula {
    name = ''
    argCount = new ArgCountImpl()
    args: Arg[] = []
    description = ''
}

export interface Arg {
    readonly argName: string
    readonly refOnly: boolean
    readonly startRepeated: boolean
    readonly description: string
}

class ArgImpl implements Arg {
    argName = ''
    refOnly = false
    startRepeated = false
    description = ''
}

export interface ArgCount {
    readonly eq: number
    readonly le: number
    readonly ge: number
    readonly odd: boolean
    readonly even: boolean
}

class ArgCountImpl implements ArgCount {
    eq = 0
    le = 0
    ge = 0
    odd = false
    even = false
}

export function formulaStandable(fn: unknown): Formula {
    const jsonFormula = fn as Formula
    const args = (jsonFormula?.args ?? []).map((arg) => {
        const a = new ArgImpl()
        shallowCopy(arg, a)
        return a
    })
    const argCount = new ArgCountImpl()
    shallowCopy(jsonFormula.argCount ?? {}, argCount)
    const formula = new FormulaImpl()
    shallowCopy(jsonFormula, formula)
    formula.args = args
    formula.argCount = argCount
    return formula
}
