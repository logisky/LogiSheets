/* eslint-disable @typescript-eslint/no-explicit-any */
import {unified} from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type {Root, Table, TableRow, TableCell} from 'mdast'

export interface MarkdownTable {
    id: string
    header: string[]
    rows: string[][]
    raw: string
}

function createProcessor() {
    return unified().use(remarkParse).use(remarkGfm)
}

function getNodeRaw(markdown: string, table: Table): string {
    if (!table.position) return ''
    const {start, end} = table.position
    if (!start || !end) return ''

    const lines = markdown.split(/\r?\n/)
    const startLine = Math.max(0, start.line - 1)
    const endLine = Math.min(lines.length - 1, end.line - 1)
    const slice = lines.slice(startLine, endLine + 1)

    if (slice.length === 0) return ''

    slice[0] = slice[0].substring(start.column - 1)
    if (slice.length === 1) {
        slice[0] = slice[0].substring(0, end.column - start.column)
    } else {
        slice[slice.length - 1] = slice[slice.length - 1].substring(
            0,
            end.column - 1
        )
    }

    return slice.join('\n')
}

function extractTextFromCell(cell: TableCell): string {
    const parts: string[] = []

    function walk(node: any): void {
        if (!node) return
        if (node.type === 'text') {
            parts.push(node.value ?? '')
            return
        }
        if (Array.isArray(node.children)) {
            for (const child of node.children) {
                walk(child)
            }
        }
    }

    walk(cell)
    return parts.join('').trim()
}

function tableToMarkdownTable(
    markdown: string,
    table: Table,
    index: number
): MarkdownTable {
    const headerRow = table.children[0] as TableRow | undefined
    const bodyRows = table.children.slice(1) as TableRow[]

    const header: string[] =
        headerRow?.children.map((c) => extractTextFromCell(c as TableCell)) ??
        []

    const rows: string[][] = bodyRows.map((row) =>
        row.children.map((c) => extractTextFromCell(c as TableCell))
    )

    const raw = getNodeRaw(markdown, table)

    return {
        id: String(index + 1),
        header,
        rows,
        raw,
    }
}

export function parseMarkdownTables(markdown: string): MarkdownTable[] {
    const processor = createProcessor()
    const tree = processor.parse(markdown) as Root

    const result: MarkdownTable[] = []
    let counter = 0

    function walk(node: any): void {
        if (!node || typeof node !== 'object') return
        if (node.type === 'table') {
            const table = node as Table
            result.push(tableToMarkdownTable(markdown, table, counter))
            counter += 1
        }
        if (Array.isArray(node.children)) {
            for (const child of node.children) {
                walk(child)
            }
        }
    }

    walk(tree)
    return result
}
