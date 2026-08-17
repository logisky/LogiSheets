import {Fragment, type ReactNode} from 'react'
import styles from '../watson.module.scss'

/**
 * A tiny, dependency-free Markdown renderer for Watson's chat output.
 *
 * It builds React nodes directly — never `dangerouslySetInnerHTML` — so it is
 * XSS-safe by construction: model text becomes text nodes, and only http(s) /
 * mailto links are emitted as anchors. It covers the subset LLMs actually
 * produce in chat: headings, **bold**, *italic*, `inline code`, fenced code
 * blocks, ordered / unordered lists, links, and paragraphs. Tables and nested
 * lists are intentionally out of scope for this first pass (see the follow-up
 * note in the Watson panel).
 */

const SAFE_HREF = /^(https?:\/\/|mailto:)/i

// Inline formatting: scan for the earliest of the supported patterns, emit the
// preceding plain text, render the match, and recurse on the remainder. Bold is
// listed before italic so that, at an equal index, `**x**` wins over `*x*`.
function inline(text: string, keyPrefix: string): ReactNode[] {
    const out: ReactNode[] = []
    let rest = text
    let k = 0

    while (rest.length > 0) {
        const key = `${keyPrefix}-${k}`
        const candidates: Array<{idx: number; len: number; node: ReactNode}> = []

        const code = /`([^`]+)`/.exec(rest)
        if (code)
            candidates.push({
                idx: code.index,
                len: code[0].length,
                node: (
                    <code key={key} className={styles.mdCode}>
                        {code[1]}
                    </code>
                ),
            })

        const bold = /\*\*([^*]+)\*\*/.exec(rest)
        if (bold)
            candidates.push({
                idx: bold.index,
                len: bold[0].length,
                node: <strong key={key}>{inline(bold[1], key)}</strong>,
            })

        const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(rest)
        if (link)
            candidates.push({
                idx: link.index,
                len: link[0].length,
                node: SAFE_HREF.test(link[2]) ? (
                    <a
                        key={key}
                        href={link[2]}
                        target="_blank"
                        rel="noreferrer noopener"
                    >
                        {link[1]}
                    </a>
                ) : (
                    // Unsafe scheme — render the source text verbatim, no anchor.
                    <Fragment key={key}>{link[0]}</Fragment>
                ),
            })

        const italic = /\*([^*\n]+)\*/.exec(rest)
        if (italic)
            candidates.push({
                idx: italic.index,
                len: italic[0].length,
                node: <em key={key}>{inline(italic[1], key)}</em>,
            })

        if (candidates.length === 0) {
            out.push(rest)
            break
        }
        // Earliest match wins; ties go to the first pushed (code/bold/link).
        const best = candidates.reduce((a, b) => (b.idx < a.idx ? b : a))
        if (best.idx > 0) out.push(rest.slice(0, best.idx))
        out.push(best.node)
        rest = rest.slice(best.idx + best.len)
        k++
    }
    return out
}

const isFenceOpen = (l: string) => /^```/.test(l)
const isFenceClose = (l: string) => /^```\s*$/.test(l)
const isHeading = (l: string) => /^#{1,6}\s+/.test(l)
const isUl = (l: string) => /^\s*[-*]\s+/.test(l)
const isOl = (l: string) => /^\s*\d+\.\s+/.test(l)

export function Markdown({text}: {text: string}) {
    const lines = text.replace(/\r\n/g, '\n').split('\n')
    const blocks: ReactNode[] = []
    let i = 0
    let key = 0

    while (i < lines.length) {
        const line = lines[i]

        // Fenced code block.
        if (isFenceOpen(line)) {
            const buf: string[] = []
            i++
            while (i < lines.length && !isFenceClose(lines[i])) {
                buf.push(lines[i])
                i++
            }
            i++ // skip the closing fence (or run off the end)
            blocks.push(
                <pre key={key++} className={styles.mdPre}>
                    <code>{buf.join('\n')}</code>
                </pre>
            )
            continue
        }

        // Heading.
        const h = line.match(/^#{1,6}\s+(.*)$/)
        if (h) {
            blocks.push(
                <div key={key} className={styles.mdHeading}>
                    {inline(h[1], `h${key}`)}
                </div>
            )
            key++
            i++
            continue
        }

        // Unordered list.
        if (isUl(line)) {
            const items: ReactNode[] = []
            while (i < lines.length && isUl(lines[i])) {
                const content = lines[i].replace(/^\s*[-*]\s+/, '')
                items.push(<li key={items.length}>{inline(content, `ul${key}-${items.length}`)}</li>)
                i++
            }
            blocks.push(<ul key={key++}>{items}</ul>)
            continue
        }

        // Ordered list.
        if (isOl(line)) {
            const items: ReactNode[] = []
            while (i < lines.length && isOl(lines[i])) {
                const content = lines[i].replace(/^\s*\d+\.\s+/, '')
                items.push(<li key={items.length}>{inline(content, `ol${key}-${items.length}`)}</li>)
                i++
            }
            blocks.push(<ol key={key++}>{items}</ol>)
            continue
        }

        // Blank line.
        if (line.trim() === '') {
            i++
            continue
        }

        // Paragraph: gather consecutive plain lines, keep their line breaks.
        const para: string[] = []
        while (
            i < lines.length &&
            lines[i].trim() !== '' &&
            !isFenceOpen(lines[i]) &&
            !isHeading(lines[i]) &&
            !isUl(lines[i]) &&
            !isOl(lines[i])
        ) {
            para.push(lines[i])
            i++
        }
        const nodes: ReactNode[] = []
        para.forEach((ln, idx) => {
            if (idx > 0) nodes.push(<br key={`br-${idx}`} />)
            nodes.push(...inline(ln, `p${key}-${idx}`))
        })
        blocks.push(<p key={key++}>{nodes}</p>)
    }

    return <div className={styles.md}>{blocks}</div>
}
