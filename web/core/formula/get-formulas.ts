import {Builder} from '@logi-base/src/ts/common/builder'
import {FORMULAS as OriginFormulas} from './formulas'
export interface Formula {
    readonly name: string
    readonly desc: string
}

class FormulaImpl implements Formula {
    public name!: string
    public desc!: string
}

export class FormulaBuilder extends Builder<Formula, FormulaImpl> {
    public constructor(obj?: Readonly<Formula>) {
        const impl = new FormulaImpl()
        if (obj)
            FormulaBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public name(name: string): this {
        this.getImpl().name = name
        return this
    }

    public desc(desc: string): this {
        this.getImpl().desc = desc
        return this
    }

    protected get daa(): readonly string[] {
        return FormulaBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'name',
        'desc',
    ]
}

export function isFormula(value: unknown): value is Formula {
    return value instanceof FormulaImpl
}

export function assertIsFormula(value: unknown): asserts value is Formula {
    if (!(value instanceof FormulaImpl))
        throw Error('Not a Formula!')
}
export const FORMULAS = OriginFormulas.map(s => {
    return new FormulaBuilder().name(s).desc('').build()
})
