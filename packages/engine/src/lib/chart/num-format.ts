/**
 * A small Excel number-format renderer for *axis ticks only*.
 *
 * Everything else a chart shows (data labels, category labels) is formatted by
 * the core, which owns the real formatter (`ssf-rs`) and can therefore render
 * any format code exactly as the sheet does. Axis ticks are the one exception:
 * the renderer picks the tick values itself, so they cannot be pre-formatted,
 * and the core's formatter lives in the worker's WASM — not reachable from a
 * synchronous ECharts callback on the main thread.
 *
 * So this covers the numeric codes an axis realistically carries — thousands
 * separators, fixed decimals, percentages, a currency prefix/suffix — and
 * falls back to the plain number for anything it does not understand. It is
 * deliberately not a general implementation: dates and text sections belong to
 * category labels, which take the core-formatted path.
 */

/** A format code reduced to the knobs an axis tick needs. */
interface NumericFormat {
    prefix: string
    suffix: string
    decimals: number
    grouped: boolean
    percent: boolean
}

/** Strip the literal-escaping syntax Excel allows around currency symbols. */
function literalOf(token: string): string {
    // [$€-x-euro2] → €, "kr" → kr, \$ → $
    const bracketed = token.match(/^\[\$([^\]-]*)/)
    if (bracketed) return bracketed[1]
    if (token.startsWith('"') && token.endsWith('"') && token.length >= 2)
        return token.slice(1, -1)
    return token.replace(/\\/g, '')
}

function parseFormat(fmt: string): NumericFormat | undefined {
    // Only the positive section drives axis ticks; negatives on an axis are
    // rendered with a leading minus by the same pattern.
    const section = fmt.split(';')[0].trim()
    if (!section || section.toLowerCase() === 'general') return undefined
    // A date/time code is not something we try to render here.
    if (/[ymdhs]/i.test(section.replace(/\[[^\]]*\]|"[^"]*"/g, ''))) return undefined

    const core = section.match(/[#0](?:[#0,]*)(?:\.[#0]+)?/)
    if (!core) return undefined
    const pattern = core[0]
    const start = section.indexOf(pattern)
    const prefixRaw = section.slice(0, start)
    const suffixRaw = section.slice(start + pattern.length)

    const percent = section.includes('%')
    const [intPart, decPart = ''] = pattern.split('.')
    return {
        prefix: literalOf(prefixRaw),
        suffix: literalOf(suffixRaw.replace('%', '')) + (percent ? '%' : ''),
        decimals: decPart.replace(/[^#0]/g, '').length,
        grouped: intPart.includes(','),
        percent,
    }
}

const cache = new Map<string, NumericFormat | undefined>()

/**
 * Render `value` with the Excel format code `fmt`. Returns the plain number
 * when there is no code, or when the code is outside the supported subset.
 */
export function formatAxisNumber(fmt: string | undefined, value: number): string {
    if (!fmt) return String(value)
    if (!cache.has(fmt)) cache.set(fmt, parseFormat(fmt))
    const f = cache.get(fmt)
    if (!f) return String(value)

    const n = f.percent ? value * 100 : value
    const body = f.grouped
        ? n.toLocaleString('en-US', {
              minimumFractionDigits: f.decimals,
              maximumFractionDigits: f.decimals,
          })
        : n.toFixed(f.decimals)
    return `${f.prefix}${body}${f.suffix}`
}
