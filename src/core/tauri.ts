// The desktop package deliberately declares NO Tauri npm dependency (see
// packages/desktop/README.md), so we can't `import { invoke } from
// '@tauri-apps/api/core'`. Tauri v2 injects its IPC entry point at runtime as
// `window.__TAURI_INTERNALS__.invoke`. Arguments are camelCase here and map to
// the Rust command's snake_case parameters.

type TauriInvoke = <T>(
    cmd: string,
    args?: Record<string, unknown>
) => Promise<T>

/** Running inside the desktop (Tauri) shell. */
export function isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function tauriInvoke<T>(
    cmd: string,
    args?: Record<string, unknown>
): Promise<T> {
    const internals = (
        window as unknown as {__TAURI_INTERNALS__?: {invoke?: TauriInvoke}}
    ).__TAURI_INTERNALS__
    if (!internals || typeof internals.invoke !== 'function')
        return Promise.reject(new Error('Tauri IPC is unavailable'))
    return internals.invoke<T>(cmd, args)
}
