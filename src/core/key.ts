export function genKey(...params: readonly (string | number)[]): string {
    return params.join('-')
}
