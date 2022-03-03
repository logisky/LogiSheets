import { getTokens, TokenType } from './lex'

const formulas = [
	'sum(1, 2)',
	'{=sum(1, 2)}',
	'=sum(',
	'=su)',
	'=SUMIF(1, 1, [32, 4, 5456])',
	'=a',
	'=abs(1)',
	'=abs()',
	'=accrint(abs(), 1,2)',
	'= ',
	'=sum(a1:b2)',
	'=a1',
	'=sum(a1,a2)',
] as const
describe('lex test', () => {
	formulas.forEach(formula => {
		it(`${formula} test`, () => {
			console.log(formula)
			const tokens = getTokens(formula)
			console.log(tokens)
		})
	})
	it('sum)', () => {
		const formula = 'sum)'
		const tokens = getTokens(formula)
		expect(tokens.length).toBe(2)
		expect(tokens[0].type).toBe(TokenType.FUNCTION)
		expect(tokens[0].value).toBe('sum')
	})
})
