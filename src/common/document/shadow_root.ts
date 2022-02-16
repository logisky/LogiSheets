export function isShadowRoot(node: Node): node is ShadowRoot {
    return node && !!(node as ShadowRoot).host && !!(node as ShadowRoot).mode
}

export function getShadowRoot(domNode: Node): ShadowRoot | null {
    let currNode = domNode
    if (isShadowRoot(currNode))
        return currNode
    while (currNode.parentNode) {
        if (currNode === document.body)
            return null
        currNode = currNode.parentNode
    }
    return isShadowRoot(currNode) ? currNode : null
}