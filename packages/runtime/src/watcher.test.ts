import {fileURLToPath} from 'node:url'
import {mkdtemp, writeFile, rm, readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {createServer, type Server} from 'node:http'
import type {AddressInfo} from 'node:net'
import {resolve, dirname, join} from 'node:path'
import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {SpreadsheetRuntime, WorkbookWatcher} from './index.js'

const FIXTURE = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../tests/6.xlsx'
)

describe('WorkbookWatcher (Node, real WASM engine)', () => {
    let rt: SpreadsheetRuntime
    let dir: string

    beforeEach(async () => {
        rt = new SpreadsheetRuntime()
        dir = await mkdtemp(join(tmpdir(), 'wb-watch-'))
    })

    afterEach(async () => {
        rt.closeAll()
        await rm(dir, {recursive: true, force: true})
    })

    async function writeDescriptor(
        file: string,
        d: {id: string; version: number | string; path: string}
    ) {
        await writeFile(join(dir, file), JSON.stringify(d))
    }

    it('loads a workbook named by a wb_*.json descriptor', async () => {
        await writeDescriptor('wb_sales.json', {
            id: 'sales',
            version: 1,
            path: FIXTURE,
        })
        const watcher = new WorkbookWatcher(rt, dir)
        await watcher.scanOnce()

        const wb = watcher.get('sales')
        expect(wb).toBeDefined()
        expect(wb!.path).toBe(FIXTURE)
        expect(watcher.ids).toEqual(['sales'])
        expect(rt.workbooks).toHaveLength(1)
    })

    it('ignores files that are not wb_*.json', async () => {
        await writeDescriptor('other.json', {
            id: 'nope',
            version: 1,
            path: FIXTURE,
        })
        const watcher = new WorkbookWatcher(rt, dir)
        await watcher.scanOnce()
        expect(watcher.ids).toEqual([])
    })

    it('does not reload when the version is unchanged', async () => {
        await writeDescriptor('wb_a.json', {
            id: 'a',
            version: 1,
            path: FIXTURE,
        })
        const watcher = new WorkbookWatcher(rt, dir)
        await watcher.scanOnce()
        const first = watcher.get('a')

        await watcher.scanOnce() // same version -> same handle
        expect(watcher.get('a')).toBe(first)
        expect(rt.workbooks).toHaveLength(1)
    })

    it('replaces the workbook when the version changes', async () => {
        await writeDescriptor('wb_a.json', {
            id: 'a',
            version: 1,
            path: FIXTURE,
        })
        const loaded: string[] = []
        const watcher = new WorkbookWatcher(rt, dir, {
            onLoad: (id) => loaded.push(id),
        })
        await watcher.scanOnce()
        const first = watcher.get('a')

        await writeDescriptor('wb_a.json', {
            id: 'a',
            version: 2,
            path: FIXTURE,
        })
        await watcher.scanOnce()

        const second = watcher.get('a')
        expect(second).not.toBe(first)
        expect(loaded).toEqual(['a', 'a'])
        // The old handle was released and only the new one remains open.
        expect(rt.workbooks).toHaveLength(1)
        expect(rt.workbooks[0]).toBe(second)
    })

    it('resolves a descriptor path relative to the watched directory', async () => {
        // Copy the fixture into the watch dir and reference it by bare name.
        const {copyFile} = await import('node:fs/promises')
        await copyFile(FIXTURE, join(dir, 'book.xlsx'))
        await writeDescriptor('wb_rel.json', {
            id: 'rel',
            version: 1,
            path: 'book.xlsx',
        })
        const watcher = new WorkbookWatcher(rt, dir)
        await watcher.scanOnce()
        expect(watcher.get('rel')).toBeDefined()
    })

    it('loads a workbook from a url when path is absent', async () => {
        const bytes = await readFile(FIXTURE)
        const server = createServer((req, res) => {
            if (req.url === '/book.xlsx') {
                res.writeHead(200)
                res.end(bytes)
            } else {
                res.writeHead(404)
                res.end()
            }
        })
        await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
        const {port} = server.address() as AddressInfo
        try {
            await writeFile(
                join(dir, 'wb_url.json'),
                JSON.stringify({
                    id: 'u',
                    version: 1,
                    url: `http://127.0.0.1:${port}/book.xlsx`,
                })
            )
            const watcher = new WorkbookWatcher(rt, dir)
            await watcher.scanOnce()
            const wb = watcher.get('u')
            expect(wb).toBeDefined()
            // A url source records no local filesystem path on the handle.
            expect(wb!.path).toBeUndefined()
        } finally {
            await new Promise<void>((r) => server.close(() => r()))
        }
    })

    it('rejects a descriptor with neither path nor url', async () => {
        await writeFile(
            join(dir, 'wb_none.json'),
            JSON.stringify({id: 'n', version: 1})
        )
        const errors: string[] = []
        const watcher = new WorkbookWatcher(rt, dir, {
            onError: (file) => errors.push(file),
        })
        await watcher.scanOnce()
        expect(watcher.get('n')).toBeUndefined()
        expect(errors.some((f) => f.includes('wb_none'))).toBe(true)
    })

    it('reports errors and keeps any previously-loaded workbook', async () => {
        await writeDescriptor('wb_good.json', {
            id: 'g',
            version: 1,
            path: FIXTURE,
        })
        // Malformed JSON and a bad path both surface via onError.
        await writeFile(join(dir, 'wb_bad.json'), '{not json')
        await writeDescriptor('wb_missing.json', {
            id: 'm',
            version: 1,
            path: join(dir, 'does-not-exist.xlsx'),
        })

        const errors: string[] = []
        const watcher = new WorkbookWatcher(rt, dir, {
            onError: (file) => errors.push(file),
        })
        await watcher.scanOnce()

        expect(watcher.get('g')).toBeDefined() // good one still loaded
        expect(watcher.get('m')).toBeUndefined() // failed load -> absent
        expect(errors).toHaveLength(2)
    })
})
