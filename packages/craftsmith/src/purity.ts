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

/**
 * Purity errors for one file (tools.ts only — modules it imports are not
 * scanned). Two rules, both syntactic:
 *
 * 1. No top-level expression statement. `const x = f()` at module scope is
 *    not caught.
 * 2. None of {@link FORBIDDEN_GLOBALS} as an identifier, except as a
 *    `.prop` access name, the right side of a qualified type name, a
 *    destructuring binding, or a parameter name. Other ambient APIs (`fetch`,
 *    `setTimeout`, `self`, ...) are allowed.
 *
 * Never throws; every finding is an `'error'`.
 */
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
            // Skip property-access names (`obj.document`), qualified type
            // names and parameter / destructuring names. Other positions —
            // object-literal keys (`{window: 1}`), `const window = …` — are
            // still flagged even though they are not global references.
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
