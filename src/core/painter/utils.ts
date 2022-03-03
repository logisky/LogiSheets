// tslint:disable: no-magic-numbers
/**
 * Only used in this folder.
 */
export function dpr(): number {
    // return window.devicePixelRatio || 1
    return 1
}

export function npx(px: number): number {
    // tslint:disable-next-line: ban
    return parseInt((px * dpr()).toString(), 10)
}

export function npxLine(px: number): number {
    const n = npx(px)
    return n > 0 ? n - 0.5 : 0.5
}

export function thinLineWidth(): number {
    return dpr() - 0.5
}