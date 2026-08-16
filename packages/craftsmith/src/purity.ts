/**
 * Heuristic purity lint for tools.ts. Fully proving purity is undecidable; this
 * catches the violations that actually break the "one function, three callers"
 * contract: ambient browser globals, and top-level side effects.
 */

import ts from 'typescript'
import type {Diagnostic} from './diagnostics.js'

const FORBIDDEN_GLOBALS = new Set([
    'window',
    'document',
    'globalThis',
    'localStorage',
    'sessionStorage',
    'navigator',
])

function lineOf(node: ts.Node): number {
    const sf = node.getSourceFile()
    return sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
}

export function lintPurity(sourceFile: ts.SourceFile): Diagnostic[] {
    const out: Diagnostic[] = []
    const file = sourceFile.fileName

    // 1. Top-level side effects: a bare expression statement at module scope
    //    (calls, assignments) runs at import time.
    for (const stmt of sourceFile.statements) {
        if (ts.isExpressionStatement(stmt)) {
            out.push({
                level: 'error',
                message:
                    'top-level side effect in tools.ts — tools must be ambient-free ' +
                    '(no code running at import). Move this inside a tool function.',
                file,
                line: lineOf(stmt),
            })
        }
    }

    // 2. Forbidden ambient globals anywhere in the file.
    const visit = (node: ts.Node): void => {
        if (ts.isIdentifier(node) && FORBIDDEN_GLOBALS.has(node.text)) {
            // Only flag when used as a value reference, not as a property name
            // (e.g. `obj.document`) or a declaration.
            const parent = node.parent
            const isPropertyAccessName =
                ts.isPropertyAccessExpression(parent) && parent.name === node
            const isQualifiedName =
                ts.isQualifiedName(parent) && parent.right === node
            const isBindingName =
                ts.isBindingElement(parent) || ts.isParameter(parent)
            if (!isPropertyAccessName && !isQualifiedName && !isBindingName) {
                out.push({
                    level: 'error',
                    message: `tools.ts references ambient global "${node.text}" — tools must be ambient-free (DOM-free). Take what you need through the tool's parameters instead.`,
                    file,
                    line: lineOf(node),
                })
            }
        }
        ts.forEachChild(node, visit)
    }
    visit(sourceFile)

    return out
}
