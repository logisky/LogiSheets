import {describe, it, expect} from 'vitest'
import {Calculator, CalcException, CustomFunc} from '../../src/api/calculator'
import type {Task} from '../../src/bindings'

describe('Calculator', () => {
    it('returns #NOTFOUND! for unregistered functions', async () => {
        const calculator = new Calculator()
        const tasks: Task[] = [{asyncFunc: 'unknown', args: ['1', '2']}]
        const result = await calculator.calc(tasks)
        expect(result.values).toEqual(['#NOTFOUND!'])
    })

    it('executes a registered synchronous function', async () => {
        const calculator = new Calculator()
        calculator.registry(
            new CustomFunc('double', async (args) =>
                String(Number(args[0]) * 2)
            )
        )
        const tasks: Task[] = [{asyncFunc: 'double', args: ['21']}]
        const result = await calculator.calc(tasks)
        expect(result.values).toEqual(['42'])
    })

    it('handles multiple tasks in order', async () => {
        const calculator = new Calculator()
        calculator.registry(
            new CustomFunc('inc', async (args) => String(Number(args[0]) + 1))
        )
        const tasks: Task[] = [
            {asyncFunc: 'inc', args: ['1']},
            {asyncFunc: 'inc', args: ['2']},
        ]
        const result = await calculator.calc(tasks)
        expect(result.values).toEqual(['2', '3'])
    })

    it('maps CalcException errors', async () => {
        const calculator = new Calculator()
        calculator.registry(
            new CustomFunc('maybeFail', async () => {
                throw new Error('fail')
            })
        )

        // Simulate executor returning each error code.
        const cases: [CalcException, string][] = [
            [CalcException.ArgErr, '#ARGERR!'],
            [CalcException.TimeOut, '#TIMEOUT!'],
            [CalcException.NotFound, '#NOTFOUND!'],
            [CalcException.Unspecified, '#UNKNOWN!'],
        ]

        for (const [exception, expected] of cases) {
            const instance = new Calculator()
            instance.registry(new CustomFunc('fail', async () => exception))
            const result = await instance.calc([{asyncFunc: 'fail', args: []}])
            expect(result.values).toEqual([expected])
        }
    })

    it('passes args to the executor', async () => {
        const calculator = new Calculator()
        const received: string[] = []
        calculator.registry(
            new CustomFunc('capture', async (args) => {
                received.push(...args)
                return 'ok'
            })
        )
        await calculator.calc([{asyncFunc: 'capture', args: ['a', 'b', 'c']}])
        expect(received).toEqual(['a', 'b', 'c'])
    })
})
