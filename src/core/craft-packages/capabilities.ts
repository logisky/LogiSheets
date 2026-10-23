import {isTauri} from '@/core/tauri'

/**
 * Host capabilities a craft can require (package.json `craftRequires` →
 * manifest `requires`). Each names a host API the craft panel injects on the
 * craft's window, under the same name.
 *
 * A craft declares what it NEEDS, not where it runs: a host states what it
 * provides, so the same package works on any host that gains a capability
 * later (e.g. the web app behind a database proxy) without being republished.
 *
 * Mirrors KNOWN_CAPABILITIES in packages/craftsmith/src/extract.ts.
 */
export const KNOWN_CAPABILITIES = [
    /**
     * Run SQL against a database connection the user configured in the host
     * (credentials stay native). Desktop only; see
     * docs/craft/data-connections.md.
     */
    'dataConnections',
] as const

export type Capability = (typeof KNOWN_CAPABILITIES)[number]

/**
 * What THIS host provides. A capability goes here in the same change that
 * injects its API into the craft panel, never before: listing one the panel
 * does not inject would install crafts that then find nothing on `window`.
 */
export function hostCapabilities(): ReadonlySet<string> {
    const caps = new Set<string>()
    // Injected as window.dataConnections by the craft panel when
    // getDataConnectionsBackend() has a backend — which is exactly on Tauri.
    if (isTauri()) caps.add('dataConnections')
    return caps
}

/** The capabilities in `requires` this host does not provide. */
export function missingCapabilities(
    requires: readonly string[] | undefined,
    provided: ReadonlySet<string> = hostCapabilities()
): string[] {
    return (requires ?? []).filter((c) => !provided.has(c))
}
