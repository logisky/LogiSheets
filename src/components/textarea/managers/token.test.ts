import { TokenManager } from './token'

describe('token manager test', () => {
	it('getTokenIndexByCursor', () => {
		const mng = new TokenManager()
		const index = mng.getTokenIndexByCursor(5, '=abs()')
		expect(index).toBe(2)
	})
})