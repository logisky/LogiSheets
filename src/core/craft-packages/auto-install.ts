import {
    getCraftPackageStore,
    installCraftPackage,
    reservedCraftIds,
} from './index'
import {
    downloadRegistryPackage,
    fetchRegistryIndex,
    pickVersion,
} from './remote'
import {parseCraftPackage} from './validate'

/**
 * Ids this browser/app has already auto-installed (or found installed). Kept
 * so each craft is installed at most once: one the user uninstalls stays
 * uninstalled, and a craft a later release adds to the list still arrives.
 */
const DONE_KEY = 'logisheets.craftAutoInstalled'

function readDone(): Set<string> {
    try {
        const raw = localStorage.getItem(DONE_KEY)
        const ids = raw ? (JSON.parse(raw) as unknown) : []
        return new Set(Array.isArray(ids) ? ids.map(String) : [])
    } catch {
        return new Set()
    }
}

function writeDone(done: Set<string>): void {
    try {
        localStorage.setItem(DONE_KEY, JSON.stringify([...done].sort()))
    } catch {
        /* storage blocked: we will simply try again next start */
    }
}

/**
 * Install the registry crafts this distribution ships with
 * (crafts.config.json → `install`), on the first start that can reach the
 * registry. Runs BEFORE `initCraftRegistry`, so on that first start they are
 * in the panel without a reload.
 *
 * Bounded by `timeoutMs`: startup waits at most that long, and whatever did
 * not finish is retried on the next start. Never throws — an offline first
 * start just opens with the bundled crafts.
 *
 * These are the build's own choice from the official registry, so they skip
 * the install dialog; the sha256 check and every install-time rule still
 * apply.
 */
export async function autoInstallCrafts(timeoutMs = 8000): Promise<void> {
    const wanted =
        typeof __CRAFT_AUTO_INSTALL__ !== 'undefined'
            ? __CRAFT_AUTO_INSTALL__
            : []
    const done = readDone()
    let todo = wanted.filter((id) => !done.has(id))
    if (!todo.length) return

    const store = getCraftPackageStore()
    try {
        const present = new Set((await store.list()).map((r) => r.craftId))
        for (const id of todo) if (present.has(id)) done.add(id)
        todo = todo.filter((id) => !done.has(id))
    } catch {
        return
    }
    if (!todo.length) {
        writeDone(done)
        return
    }

    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), timeoutMs)
    try {
        const index = await fetchRegistryIndex(abort.signal)
        const reserved = reservedCraftIds()
        await Promise.all(
            todo.map(async (id) => {
                const craft = index.crafts.find((c) => c.craftId === id)
                const v = craft && pickVersion(craft)
                // Not published yet, or only for a newer app: try next start.
                if (!v) return
                try {
                    const bytes = await downloadRegistryPackage(v, abort.signal)
                    await installCraftPackage(
                        parseCraftPackage(bytes, reserved)
                    )
                    done.add(id)
                } catch (e) {
                    if (!abort.signal.aborted)
                        // eslint-disable-next-line no-console
                        console.warn(`[crafts] auto-install of ${id} failed`, e)
                }
            })
        )
    } catch {
        /* offline, or the registry is down: try next start */
    } finally {
        clearTimeout(timer)
        writeDone(done)
    }
}
