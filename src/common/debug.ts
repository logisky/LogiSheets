import {DEBUG_ERR, DEBUG_WEB} from './const'
export function debugWeb(title: string, ...message: readonly unknown[]): void {
    if (DEBUG_WEB)
        log(title, message)
}

export function error(...message: readonly unknown[]) {
    if (DEBUG_ERR)
        log('[error]: ', message)
}

function log(title: string, message: unknown): void {
    let pre = title
    if (!pre.startsWith('['))
        pre = `[${pre}]`
    // eslint-disable-next-line no-console
    console.log(pre, message)
}
