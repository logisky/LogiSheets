// tslint:disable: unknown-paramenter-for-type-predicate
// tslint:disable: no-double-negation
export function isShadowRoot(node: Node): node is ShadowRoot {
    return node && !!(<ShadowRoot>node).host && !!(<ShadowRoot>node).mode
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