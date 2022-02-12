export function commonSuffix(a: string, b: string): string {
    const strs = []
    const aLastIndex = a.length - 1
    const bLastIndex = b.length - 1
    const len = Math.min(a.length, b.length)
    for (let i = 0; i < len; i += 1) {
        if (a.charCodeAt(aLastIndex - i) !== b.charCodeAt(bLastIndex - i))
            break
        strs.push(a[i])
    }
    return strs.join('')
}

export function commonSuffixLength(a: string, b: string): number {
    return commonSuffix(a, b).length
}

export function commonPrefix(a: string, b: string): string {
    const strs = []
    const len = Math.min(a.length, b.length)
    for (let i = 0; i < len; i += 1) {
        if (a.charCodeAt(i) !== b.charCodeAt(i))
            break
        strs.push(a[i])
    }
    return strs.join('')
}

export function commonPrefixLength(a: string, b: string): number {
    return commonPrefix(a, b).length
}
