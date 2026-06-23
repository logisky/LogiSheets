// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function shallowCopy(curr: any, target: any) {
    if (typeof curr !== 'object' || typeof target !== 'object') return
    for (const key in curr) {
        if (Object.prototype.hasOwnProperty.call(curr, key)) {
            target[key] = curr[key]
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepCopy(curr: any, target: any) {
    if (typeof curr !== 'object' || typeof target !== 'object') return
    for (const key in curr) {
        const v = curr[key]
        if (typeof v !== 'object') {
            target[key] = v
        } else {
            const value = Array.isArray(v) ? [] : {}
            deepCopy(curr[key], value)
        }
    }
}
