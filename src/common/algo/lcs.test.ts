import { lcsLenMatch } from './lcs'
describe('lcs test', () => {
	it('lcsLenMatch', () => {
		const pattern = 'at'
		const beMatched = ['bath', 'banana', 'ant', 'at']
		const getValue = (beMatched: string) => beMatched
		const matchInfo = lcsLenMatch(pattern, beMatched, getValue)
		console.log(matchInfo)
	})
})