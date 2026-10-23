import {strToU8, zipSync} from 'fflate'
import {describe, expect, it} from 'vitest'
import {
    CraftPackageError,
    MAX_FILE_BYTES,
    isSafePackagePath,
    parseCraftPackage,
} from './validate'
import {HOST_API_VERSION} from './types'

const RESERVED = new Set(['lights-out', 'watson'])

function manifest(over: Record<string, unknown> = {}) {
    return {
        schemaVersion: 1,
        craftId: 'my-craft',
        version: '1.0.0',
        label: 'My Craft',
        url: 'index.html',
        files: ['index.html', 'app.js'],
        ...over,
    }
}

function pkg(
    m: unknown = manifest(),
    files: Record<string, Uint8Array> = {
        'index.html': strToU8('<html></html>'),
        'app.js': strToU8('1'),
    }
): Uint8Array {
    return zipSync({
        'manifest.json': strToU8(JSON.stringify(m)),
        ...files,
    })
}

function code(fn: () => unknown): string | undefined {
    try {
        fn()
    } catch (e) {
        if (e instanceof CraftPackageError) return e.code
        throw e
    }
    return undefined
}

describe('parseCraftPackage', () => {
    it('accepts a packed craft and keeps only the listed files', () => {
        const bytes = pkg(manifest(), {
            'index.html': strToU8('<html></html>'),
            'app.js': strToU8('1'),
            'stray.txt': strToU8('not listed'),
        })
        const {manifest: m, files} = parseCraftPackage(bytes, RESERVED)
        expect(m.craftId).toBe('my-craft')
        expect([...files.keys()].sort()).toEqual([
            'app.js',
            'index.html',
            'manifest.json',
        ])
    })

    it('refuses something that is not a zip', () => {
        expect(code(() => parseCraftPackage(strToU8('hello'), RESERVED))).toBe(
            'notZip'
        )
    })

    it('refuses a package without a manifest', () => {
        const bytes = zipSync({'index.html': strToU8('x')})
        expect(code(() => parseCraftPackage(bytes, RESERVED))).toBe(
            'noManifest'
        )
    })

    it('refuses a bare dist/ manifest (no files list)', () => {
        const m = manifest()
        delete (m as {files?: unknown}).files
        expect(code(() => parseCraftPackage(pkg(m), RESERVED))).toBe(
            'badManifest'
        )
    })

    it('refuses a package with neither UI nor tools', () => {
        const m = manifest({url: undefined, files: ['app.js']})
        expect(code(() => parseCraftPackage(pkg(m), RESERVED))).toBe(
            'badManifest'
        )
    })

    it.each(['My-Craft', 'a_b', 'a__b', '-x', 'x'.repeat(33), ''])(
        'refuses craft id %j',
        (id) => {
            expect(
                code(() =>
                    parseCraftPackage(pkg(manifest({craftId: id})), RESERVED)
                )
            ).toBe('badId')
        }
    )

    it('refuses a built-in or host id', () => {
        for (const id of ['lights-out', 'watson'])
            expect(
                code(() =>
                    parseCraftPackage(pkg(manifest({craftId: id})), RESERVED)
                )
            ).toBe('reservedId')
    })

    it('refuses a package needing a newer host', () => {
        const m = manifest({hostApi: HOST_API_VERSION + 1})
        expect(code(() => parseCraftPackage(pkg(m), RESERVED))).toBe('hostApi')
    })

    it('refuses a package needing a capability this host lacks', () => {
        const m = manifest({requires: ['dataConnections']})
        let err: unknown
        try {
            parseCraftPackage(pkg(m), RESERVED, new Set())
        } catch (e) {
            err = e
        }
        expect(err).toBeInstanceOf(CraftPackageError)
        expect((err as CraftPackageError).code).toBe('unsupported')
        expect((err as CraftPackageError).params.missing).toBe(
            'dataConnections'
        )
    })

    it('installs it on a host that provides the capability', () => {
        const m = manifest({requires: ['dataConnections']})
        const {manifest: parsed} = parseCraftPackage(
            pkg(m),
            RESERVED,
            new Set(['dataConnections'])
        )
        expect(parsed.requires).toEqual(['dataConnections'])
    })

    it('refuses a malformed requires list', () => {
        const m = manifest({requires: 'dataConnections'})
        expect(code(() => parseCraftPackage(pkg(m), RESERVED))).toBe(
            'badManifest'
        )
    })

    it('refuses a path that escapes the package', () => {
        const m = manifest({files: ['index.html', '../evil.js']})
        const bytes = pkg(m, {
            'index.html': strToU8('x'),
            '../evil.js': strToU8('x'),
        })
        expect(code(() => parseCraftPackage(bytes, RESERVED))).toBe('badPath')
    })

    it('refuses a listed file that is missing', () => {
        const bytes = pkg(manifest(), {'index.html': strToU8('x')})
        expect(code(() => parseCraftPackage(bytes, RESERVED))).toBe(
            'missingFile'
        )
    })

    it('refuses a tool entry that is not in the package', () => {
        const m = manifest({
            tools: [{name: 't', entry: 'tools.js', export: 't'}],
        })
        expect(code(() => parseCraftPackage(pkg(m), RESERVED))).toBe(
            'missingFile'
        )
    })

    it('refuses an oversized file', () => {
        const bytes = pkg(manifest(), {
            'index.html': strToU8('x'),
            'app.js': new Uint8Array(MAX_FILE_BYTES + 1),
        })
        expect(code(() => parseCraftPackage(bytes, RESERVED))).toBe('tooLarge')
    })
})

describe('isSafePackagePath', () => {
    it.each(['index.html', 'assets/a-b_c.v2.png', 'x'])('accepts %j', (p) =>
        expect(isSafePackagePath(p)).toBe(true)
    )
    it.each([
        '',
        '/abs.js',
        '../up.js',
        'a/../b.js',
        './a.js',
        'a//b.js',
        'a\\b.js',
        '.hidden',
        'sp ace.js',
        'C:/x.js',
    ])('rejects %j', (p) => expect(isSafePackagePath(p)).toBe(false))
})
