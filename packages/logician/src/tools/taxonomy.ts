/**
 * Tool taxonomy — a multi-level category tree over the (now ~57) tools, for
 * organizing / browsing them. This is an ORGANIZATIONAL overlay, independent of
 * the LLM-facing tool id (`namespace__name`, which stays flat).
 *
 * A tool's category comes from its own `category` field if set, else from the
 * built-in `defaultCategory` below (keyed by namespace/name). `buildToolTree`
 * groups any Tool[] into a nested tree by category path — so new tools always
 * appear (under their namespace) even before they're added to the taxonomy.
 */

import {toolId} from '../tool.js'
import type {Tool} from '../tool.js'

// Per-tool overrides where a namespace mixes categories (e.g. `cell` has both
// reads and writes; `build` holds block tools plus a sheet/formula/checkpoint).
const OVERRIDES: Record<string, readonly string[]> = {
    cell__get_cells: ['Data', 'Read'],
    cell__set_cells: ['Data', 'Write'],
    cell__clear_cells: ['Data', 'Write'],
    cell__fill: ['Data', 'Write'],
    build__eval_formula: ['Data', 'Read'],
    inspect__get_active_selection: ['Data', 'Read'],
    build__create_sheet: ['Structure', 'Sheets'],
    build__checkpoint: ['History'],
}

/** The default multi-level category for a tool (used when it has no `category`). */
export function defaultCategory(t: Pick<Tool, 'namespace' | 'name'>): readonly string[] {
    const id = `${t.namespace}__${t.name}`
    if (OVERRIDES[id]) return OVERRIDES[id]
    switch (t.namespace) {
        case 'inspect':
            return ['Inspect']
        case 'format':
            return ['Format']
        case 'sheet':
            // Whole-sheet ops contain "sheet" in the name; the rest are row/col.
            return ['Structure', t.name.includes('sheet') ? 'Sheets' : 'Rows & Columns']
        case 'build':
        case 'edit':
            return ['Blocks']
        case 'link':
            return ['Blocks', 'Links']
        case 'comment':
            return ['Comments']
        case 'history':
            return ['History']
        case 'craft':
            return ['Interactions']
        case 'skills':
            return ['Skills']
        default:
            return [t.namespace]
    }
}

export interface ToolTreeLeaf {
    id: string
    name: string
    description: string
}
export interface ToolTreeNode {
    /** This node's segment name (e.g. "Data", "Write"). */
    name: string
    /** Full path from the root to this node. */
    path: readonly string[]
    /** Tools that live directly at this node. */
    tools: ToolTreeLeaf[]
    /** Sub-categories. */
    children: ToolTreeNode[]
}

/** Group tools into a nested category tree (top-level nodes returned). */
export function buildToolTree(tools: readonly Tool[]): ToolTreeNode[] {
    const root: ToolTreeNode = {name: '', path: [], tools: [], children: []}
    for (const t of tools) {
        const path = t.category ?? defaultCategory(t)
        let node = root
        const acc: string[] = []
        for (const seg of path) {
            acc.push(seg)
            let child = node.children.find((c) => c.name === seg)
            if (!child) {
                child = {name: seg, path: [...acc], tools: [], children: []}
                node.children.push(child)
            }
            node = child
        }
        node.tools.push({id: toolId(t), name: t.name, description: t.description})
    }
    sortTree(root)
    return root.children
}

function sortTree(node: ToolTreeNode): void {
    node.children.sort((a, b) => a.name.localeCompare(b.name))
    node.tools.sort((a, b) => a.id.localeCompare(b.id))
    node.children.forEach(sortTree)
}

/** Render the tree as an indented outline (for logs / a picker / debugging). */
export function formatToolTree(nodes: readonly ToolTreeNode[], indent = 0): string {
    const pad = '  '.repeat(indent)
    const lines: string[] = []
    for (const n of nodes) {
        lines.push(`${pad}${n.name}/`)
        for (const t of n.tools) lines.push(`${pad}  ${t.id}`)
        if (n.children.length) lines.push(formatToolTree(n.children, indent + 1))
    }
    return lines.join('\n')
}
