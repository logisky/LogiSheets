import {FORMULAS as OriginFormulas} from './formulas'
export class Formula {
    public name = ''
    public desc = ''
}

export const FORMULAS = OriginFormulas.map(s => {
    const formula = new Formula()
    formula.name = s
    return formula
})
