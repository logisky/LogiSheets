export function shallowCopy(curr: Object, target: Object) {
    Object.keys(curr).forEach(key => {
        // @ts-expect-error for clone
        target[key] = curr[key]
    })
}
