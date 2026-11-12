import {describe, expect, it} from 'vitest'
import {preservedChartLabel} from './preserved'

describe('preservedChartLabel', () => {
    it('names the chartEx kinds by their layoutId', () => {
        expect(preservedChartLabel('waterfall')).toBe('Waterfall chart')
        expect(preservedChartLabel('clusteredColumn')).toBe('Histogram chart')
    })

    it('falls back to a plain label for anything else', () => {
        expect(preservedChartLabel('chart')).toBe('Chart')
        expect(preservedChartLabel('somethingNew')).toBe('Chart')
    })
})
