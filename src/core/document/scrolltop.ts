export function getParentScrollTop(node: Element): readonly number[] {
    let curr = node
    const scrollTops: number[] = []
    for (let i = 0; curr && curr.nodeType === curr.ELEMENT_NODE; i++) {
        scrollTops[i] = curr.scrollTop
        curr = <Element>curr.parentElement
    }
    return scrollTops
}

export function restoreParentsScrollTop(
    node: Element,
    state: readonly number[]
): void {
    let curr = node
    for (let i = 0; curr && curr.nodeType === curr.ELEMENT_NODE; i++) {
        if (curr.scrollTop !== state[i]) curr.scrollTop = state[i]
        curr = <Element>curr.parentNode
    }
}
