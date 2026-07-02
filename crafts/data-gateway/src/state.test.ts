import {describe, it, expect} from 'vitest'
import type {CellId} from 'logisheets-web'
import {
    DATA_GATEWAY_VERSION,
    emptyState,
    serializeState,
    parseState,
    normalizeState,
    validationKey,
    cellIdKey,
    type DataGatewayState,
} from './state'

const normalCell = (row: number, col: number): CellId => ({
    type: 'normalCell',
    value: {row, col},
})

describe('data-gateway state schema', () => {
    it('round-trips a full state through serialize/parse', () => {
        const state: DataGatewayState = {
            version: DATA_GATEWAY_VERSION,
            inputBlocks: ['orders', 'customers'],
            outputBlocks: ['totals'],
            validations: [
                {sheetId: 1, cellId: normalCell(0, 0), formula: 'A1>0'},
            ],
        }
        expect(parseState(serializeState(state))).toEqual(state)
    })

    it('returns an empty state for undefined / garbage / non-object json', () => {
        expect(parseState(undefined)).toEqual(emptyState())
        expect(parseState('not json')).toEqual(emptyState())
        expect(parseState('[1,2,3]')).toEqual(emptyState())
        expect(parseState('42')).toEqual(emptyState())
    })

    it('dedups block ref names and drops empty / non-string entries', () => {
        const s = normalizeState({
            inputBlocks: ['a', 'a', '', 3, 'b'],
            outputBlocks: ['x', 'x'],
        })
        expect(s.inputBlocks).toEqual(['a', 'b'])
        expect(s.outputBlocks).toEqual(['x'])
    })

    it('drops malformed validation entries but keeps valid ones', () => {
        const s = normalizeState({
            validations: [
                {sheetId: 1, cellId: normalCell(0, 0), formula: 'A1>0'},
                {sheetId: 1, cellId: normalCell(0, 0), formula: ''}, // empty formula
                {sheetId: 'x', cellId: normalCell(1, 1), formula: 'B2>0'}, // bad sheetId
                {cellId: normalCell(2, 2), formula: 'C3>0'}, // missing sheetId
                {sheetId: 2, formula: 'D4>0'}, // missing cellId
                {sheetId: 2, cellId: {type: 'bogus'}, formula: 'E5>0'}, // bad cellId
            ],
        })
        expect(s.validations).toEqual([
            {sheetId: 1, cellId: normalCell(0, 0), formula: 'A1>0'},
        ])
    })

    it('dedups validation entries by (sheetId, cellId)', () => {
        const s = normalizeState({
            validations: [
                {sheetId: 1, cellId: normalCell(0, 0), formula: 'A1>0'},
                {sheetId: 1, cellId: normalCell(0, 0), formula: 'A1>100'},
                {sheetId: 2, cellId: normalCell(0, 0), formula: 'A1>0'},
            ],
        })
        expect(s.validations).toHaveLength(2)
    })

    it('normalizes block and ephemeral cell ids', () => {
        const s = normalizeState({
            validations: [
                {
                    sheetId: 1,
                    cellId: {
                        type: 'blockCell',
                        value: {blockId: 7, row: 2, col: 3},
                    },
                    formula: 'x>0',
                },
                {
                    sheetId: 1,
                    cellId: {type: 'ephemeralCell', value: 9},
                    formula: 'y>0',
                },
            ],
        })
        expect(s.validations).toHaveLength(2)
        expect(s.validations[0].cellId).toEqual({
            type: 'blockCell',
            value: {blockId: 7, row: 2, col: 3},
        })
    })

    it('produces stable keys per cell-id variant', () => {
        expect(cellIdKey(normalCell(1, 2))).toBe('n:1:2')
        expect(
            cellIdKey({type: 'blockCell', value: {blockId: 5, row: 1, col: 2}})
        ).toBe('b:5:1:2')
        expect(cellIdKey({type: 'ephemeralCell', value: 8})).toBe('e:8')
        expect(validationKey(3, normalCell(1, 2))).toBe('3:n:1:2')
    })

    it('always stamps the current version', () => {
        expect(normalizeState({version: 999}).version).toBe(
            DATA_GATEWAY_VERSION
        )
    })
})
