import {existsSync, readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, it} from 'vitest'

// Every subpath in package.json `exports` must be backed by a source module,
// or the published package ships an import that fails to resolve. Removing a
// directory under src/ without dropping its export entry is the usual cause
// (see #538, `./selection`).
const pkgDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))

// ./dist/foo/index.js | ./dist/foo/index.d.ts -> src/foo/index.ts
function sourceFor(distPath: string): string {
    return join(
        pkgDir,
        distPath.replace(/^\.\/dist\//, 'src/').replace(/\.d\.ts$|\.js$/, '.ts')
    )
}

describe('package.json exports', () => {
    for (const [subpath, target] of Object.entries(
        pkg.exports as Record<string, Record<string, string>>
    )) {
        it(`${subpath} has a source module`, () => {
            for (const distPath of Object.values(target)) {
                expect(existsSync(sourceFor(distPath)), distPath).toBe(true)
            }
        })
    }
})
