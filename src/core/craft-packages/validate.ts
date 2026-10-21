import {unzipSync, strFromU8} from 'fflate'
import type {CraftManifest} from 'logisheets-logician'
import {HOST_API_VERSION} from './types'

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_PACKAGE_BYTES = 20 * 1024 * 1024
/**
 * Watson names a craft's tools `<craftId>__<tool>` and providers cap a tool
 * name at 64 characters, so the id gets at most half.
 */
export const MAX_CRAFT_ID_LENGTH = 32

/**
 * Why a package was refused. The code picks the message the install dialog
 * shows (`ui.craft.install.error.<code>`); `params` fills its placeholders.
 */
export type CraftPackageErrorCode =
    | 'notZip'
    | 'noManifest'
    | 'badManifest'
    | 'badId'
    | 'reservedId'
    | 'hostApi'
    | 'badPath'
    | 'missingFile'
    | 'tooLarge'
    // Registry downloads (remote.ts)
    | 'registryUnavailable'
    | 'download'
    | 'checksum'

export class CraftPackageError extends Error {
    constructor(
        readonly code: CraftPackageErrorCode,
        readonly params: Record<string, string | number> = {}
    ) {
        const detail = Object.keys(params).length
            ? ` ${JSON.stringify(params)}`
            : ''
        super(`craft package refused: ${code}${detail}`)
        this.name = 'CraftPackageError'
    }
}

export interface ParsedCraftPackage {
    manifest: CraftManifest
    /** Exactly `manifest.files`, plus `manifest.json`. */
    files: Map<string, Uint8Array>
}

const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/

/**
 * A package path the loader can serve and the desktop backend can write:
 * relative, `/`-separated, ASCII, no `.`/`..` segments and no hidden files.
 * Deliberately narrower than what a zip may hold — the host would rather
 * refuse a file name than reason about one.
 */
export function isSafePackagePath(p: string): boolean {
    if (!p || p.length > 200) return false
    return p.split('/').every((seg) => SEGMENT.test(seg))
}

export function isValidCraftId(id: string): boolean {
    return id.length <= MAX_CRAFT_ID_LENGTH && /^[a-z0-9][a-z0-9-]*$/.test(id)
}

/**
 * Unpack and validate a `.craft` file (see `craftsmith pack`). Throws a
 * `CraftPackageError` on anything the host will not install.
 *
 * `reservedIds` are ids an installed craft may not take: every built-in craft
 * (in any distribution, since a workbook travels between them) and the ones
 * the host uses for itself. Identity is the craft id — block ownership, craft
 * state and Watson's tool names all hang off it — so sharing one means sharing
 * those.
 */
export function parseCraftPackage(
    bytes: Uint8Array,
    reservedIds: ReadonlySet<string>
): ParsedCraftPackage {
    if (bytes.byteLength > MAX_PACKAGE_BYTES)
        throw new CraftPackageError('tooLarge', {
            limitMb: MAX_PACKAGE_BYTES / 1024 / 1024,
        })

    let entries: Record<string, Uint8Array>
    try {
        entries = unzipSync(bytes, {
            // Header sizes can lie, so the totals are checked again below;
            // this just avoids inflating an obviously oversized entry.
            filter: (f) => !f.name.endsWith('/'),
        })
    } catch {
        throw new CraftPackageError('notZip')
    }

    let total = 0
    for (const [name, data] of Object.entries(entries)) {
        if (data.byteLength > MAX_FILE_BYTES)
            throw new CraftPackageError('tooLarge', {
                limitMb: MAX_FILE_BYTES / 1024 / 1024,
                file: name,
            })
        total += data.byteLength
    }
    if (total > MAX_PACKAGE_BYTES)
        throw new CraftPackageError('tooLarge', {
            limitMb: MAX_PACKAGE_BYTES / 1024 / 1024,
        })

    const rawManifest = entries['manifest.json']
    if (!rawManifest) throw new CraftPackageError('noManifest')
    let manifest: CraftManifest
    try {
        manifest = JSON.parse(strFromU8(rawManifest)) as CraftManifest
    } catch {
        throw new CraftPackageError('badManifest')
    }
    if (
        !manifest ||
        manifest.schemaVersion !== 1 ||
        typeof manifest.craftId !== 'string' ||
        typeof manifest.version !== 'string' ||
        typeof manifest.label !== 'string' ||
        // Only `craftsmith pack` writes `files`; a bare dist/manifest.json
        // is not an installable package.
        !Array.isArray(manifest.files) ||
        !manifest.files.every((f) => typeof f === 'string')
    )
        throw new CraftPackageError('badManifest')

    const id = manifest.craftId
    if (!isValidCraftId(id))
        throw new CraftPackageError('badId', {
            id,
            max: MAX_CRAFT_ID_LENGTH,
        })
    if (reservedIds.has(id)) throw new CraftPackageError('reservedId', {id})

    const hostApi = manifest.hostApi ?? 1
    if (!Number.isInteger(hostApi) || hostApi > HOST_API_VERSION)
        throw new CraftPackageError('hostApi', {
            need: String(hostApi),
            have: HOST_API_VERSION,
        })

    const files = new Map<string, Uint8Array>()
    files.set('manifest.json', rawManifest)
    for (const f of manifest.files) {
        if (f === 'manifest.json') continue
        if (!isSafePackagePath(f))
            throw new CraftPackageError('badPath', {file: f})
        const data = entries[f]
        if (!data) throw new CraftPackageError('missingFile', {file: f})
        files.set(f, data)
    }
    // Entries the manifest does not list are dropped: the loader serves the
    // list, so an unlisted file could never be reached anyway.

    const needed = [
        ...(manifest.url ? [manifest.url] : []),
        ...(manifest.tools ?? []).map((t) => t.entry),
    ]
    for (const f of needed)
        if (!files.has(f)) throw new CraftPackageError('missingFile', {file: f})
    if (!manifest.url && !manifest.tools?.length)
        throw new CraftPackageError('badManifest')

    return {manifest, files}
}
