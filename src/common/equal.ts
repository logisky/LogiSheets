export function equal(a: Object, b: Object) {
    let result = true
    Object.keys(a).forEach(key => {
        // @ts-expect-error
        if (!b[key])
            result = false
        // @ts-expect-error
        if (a[key] !== b[key])
            result = false
    })
    return result
}