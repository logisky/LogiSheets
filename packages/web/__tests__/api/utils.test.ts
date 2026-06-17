import {describe, it, expect} from 'vitest'
import {isErrorMessage, getPatternFill} from '../../src/api/utils'
import type {Fill} from '../../src/bindings'

describe('isErrorMessage', () => {
    it('returns true for valid error messages', () => {
        expect(isErrorMessage({msg: 'oops', ty: 1})).toBe(true)
    })

    it('returns false for null', () => {
        expect(isErrorMessage(null)).toBe(false)
    })

    it('returns false for primitives', () => {
        expect(isErrorMessage('error')).toBe(false)
        expect(isErrorMessage(42)).toBe(false)
    })

    it('returns false when msg is missing', () => {
        expect(isErrorMessage({ty: 1})).toBe(false)
    })

    it('returns false when ty is missing', () => {
        expect(isErrorMessage({msg: 'oops'})).toBe(false)
    })
})

describe('getPatternFill', () => {
    it('returns the pattern fill value', () => {
        const fill: Fill = {type: 'patternFill', value: {patternType: 'solid'}}
        expect(getPatternFill(fill)).toEqual({patternType: 'solid'})
    })

    it('returns null for gradient fills', () => {
        const fill: Fill = {
            type: 'gradientFill',
            value: {
                ty: 'linear',
                degree: 0,
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                stops: [],
            },
        }
        expect(getPatternFill(fill)).toBeNull()
    })
})
