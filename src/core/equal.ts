// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function equal(a: any, b: any) {
    let result = true
    Object.keys(a).forEach((key) => {
        if (!b[key]) result = false
        if (a[key] !== b[key]) result = false
    })
    return result
}
