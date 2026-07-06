export function simpleUuid() {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
        (+c ^ (randomByte() & (15 >> (+c / 4)))).toString(16)
    )
}

// `crypto` isn't a typed global here (this package targets ES2020 with no DOM
// lib, and it must run on both the browser and Node). Reach it through
// `globalThis` when available (browsers, Node >= 19) and fall back to
// Math.random otherwise — these ids aren't security-sensitive.
function randomByte(): number {
    const webcrypto = (
        globalThis as {
            crypto?: {getRandomValues?: (a: Uint8Array) => Uint8Array}
        }
    ).crypto
    if (webcrypto?.getRandomValues) {
        return webcrypto.getRandomValues(new Uint8Array(1))[0]
    }
    return Math.floor(Math.random() * 256)
}
