import {afterEach, describe, expect, it} from 'vitest'
import {hostCapabilities, missingCapabilities} from './capabilities'

const g = globalThis as unknown as {window?: Record<string, unknown>}

describe('hostCapabilities', () => {
    const had = 'window' in g
    const saved = g.window
    afterEach(() => {
        if (had) g.window = saved
        else delete g.window
    })

    it('provides dataConnections on desktop (Tauri)', () => {
        g.window = {__TAURI_INTERNALS__: {}}
        expect(hostCapabilities().has('dataConnections')).toBe(true)
        expect(missingCapabilities(['dataConnections'])).toEqual([])
    })

    it('provides nothing on the web', () => {
        g.window = {}
        expect(hostCapabilities().size).toBe(0)
        expect(missingCapabilities(['dataConnections'])).toEqual([
            'dataConnections',
        ])
    })
})
