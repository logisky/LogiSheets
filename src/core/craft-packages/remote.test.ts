import {describe, expect, it} from 'vitest'
import {pickVersion, unavailableReason, type RegistryCraft} from './remote'
import {HOST_API_VERSION} from './types'

function craft(versions: RegistryCraft['versions']): RegistryCraft {
    return {
        craftId: 'c',
        label: 'C',
        hasUi: true,
        tools: [],
        latest: versions[versions.length - 1]?.version ?? '',
        versions,
    }
}

function v(version: string, extra: Partial<RegistryCraft['versions'][0]> = {}) {
    return {
        version,
        hostApi: 1,
        url: `packages/c/c-${version}.craft`,
        sha256: '',
        size: 1,
        publishedAt: '',
        ...extra,
    }
}

describe('pickVersion', () => {
    it('takes the newest version', () => {
        expect(pickVersion(craft([v('0.1.0'), v('0.2.0')]))?.version).toBe(
            '0.2.0'
        )
    })

    it('falls back past versions needing a newer app', () => {
        const c = craft([
            v('0.1.0'),
            v('0.2.0', {hostApi: HOST_API_VERSION + 1}),
        ])
        expect(pickVersion(c)?.version).toBe('0.1.0')
    })

    it('falls back past versions needing a missing capability', () => {
        const c = craft([
            v('0.1.0'),
            v('0.2.0', {requires: ['dataConnections']}),
        ])
        expect(pickVersion(c, new Set())?.version).toBe('0.1.0')
        expect(pickVersion(c, new Set(['dataConnections']))?.version).toBe(
            '0.2.0'
        )
    })
})

describe('unavailableReason', () => {
    it('is undefined when some version runs', () => {
        expect(unavailableReason(craft([v('0.1.0')]))).toBeUndefined()
    })

    it('names the missing capabilities of the newest version', () => {
        const c = craft([v('0.1.0', {requires: ['dataConnections']})])
        expect(unavailableReason(c, new Set())).toEqual({
            missing: ['dataConnections'],
        })
    })

    it('says a newer app is needed otherwise', () => {
        const c = craft([v('0.1.0', {hostApi: HOST_API_VERSION + 1})])
        expect(unavailableReason(c)).toEqual({hostApi: HOST_API_VERSION + 1})
    })
})
