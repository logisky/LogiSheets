// tslint:disable: no-object
// eslint-disable-next-line @typescript-eslint/ban-types
export function shallowCopy(curr: Object, target: Object) {
    Object.keys(curr).forEach(key => {
        // @ts-expect-error for clone
        target[key] = curr[key]
    })
}
