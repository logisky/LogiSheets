import {describe, it, expect} from 'vitest'
import {callerRegistry, isFieldUserEditable} from './index.js'

describe('callerRegistry', () => {
    it('assigns a stable user uuid', () => {
        const a = callerRegistry.getUserUuid()
        const b = callerRegistry.getUserUuid()
        expect(a).toBe(b)
        expect(callerRegistry.isUser(a)).toBe(true)
        expect(callerRegistry.isUser('nope')).toBe(false)
        expect(callerRegistry.isUser(undefined)).toBe(false)
    })

    it('assigns distinct, stable craft uuids and rejects the user key', () => {
        const c1 = callerRegistry.getCraftUuid('craft-1')
        expect(callerRegistry.getCraftUuid('craft-1')).toBe(c1)
        expect(callerRegistry.getCraftUuid('craft-2')).not.toBe(c1)
        expect(callerRegistry.isUser(c1)).toBe(false)
        expect(() => callerRegistry.getCraftUuid('__user__')).toThrow()
    })

    it('tracks block owners by (sheet, block)', () => {
        callerRegistry.registerBlockOwner(0, 7, 'owner-x')
        expect(callerRegistry.getBlockOwner(0, 7)).toBe('owner-x')
        expect(callerRegistry.getBlockOwner(0, 8)).toBeUndefined()
    })

    it('resolves field renderId by column then row, column wins', () => {
        callerRegistry.registerFieldPosition(0, 1, 'col', 2, 'render-col')
        callerRegistry.registerFieldPosition(0, 1, 'row', 3, 'render-row')
        // blockCol=2 matches the column entry first
        expect(callerRegistry.getFieldRenderId(0, 1, 3, 2)).toBe('render-col')
        // blockCol with no column entry falls back to the row entry
        expect(callerRegistry.getFieldRenderId(0, 1, 3, 9)).toBe('render-row')
        // neither matches
        expect(callerRegistry.getFieldRenderId(0, 1, 5, 9)).toBeUndefined()
    })
})

describe('isFieldUserEditable', () => {
    it('blocks only when userEditable === false', () => {
        expect(isFieldUserEditable({userEditable: false})).toBe(false)
    })

    it('permits true / undefined / formula-string / missing field', () => {
        expect(isFieldUserEditable({userEditable: true})).toBe(true)
        expect(isFieldUserEditable({})).toBe(true)
        expect(isFieldUserEditable({userEditable: 'A1>0'})).toBe(true)
        expect(isFieldUserEditable(undefined)).toBe(true)
    })
})
