import { getAllFormulas } from './formulas'

describe('formula test', () => {
    let formulas: ReturnType<typeof getAllFormulas>
    beforeEach(() => {
        formulas = getAllFormulas()
    })
    it('struct test', () => {
        expect(Array.isArray(formulas)).toBeTruthy()
    })
    it('count test', () => {
        const descs = formulas.map(f => f.getParamDesc())
        descs.forEach(desc => {
            expect(desc).not.toBeUndefined()
            if (!desc)
                return
            if (desc.count === -1)
                return
            expect(desc.params.length).toBe(desc.count)
        })
    })
})