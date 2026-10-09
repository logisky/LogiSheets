// CSV import: bytes → text → records → cell inputs.
//
// Pure functions, so the browser app and the Node runtime parse a file the
// same way. Writing the records into a sheet is WorkbookOps.importCsv.

/** Delimiters `detectDelimiter` will consider, in tie-break order. */
const DELIMITERS = [',', '\t', ';', '|'] as const

/**
 * Decode a CSV file's bytes. A byte-order mark decides when there is one;
 * otherwise UTF-8, falling back to GB18030 when the bytes are not valid
 * UTF-8 — what Excel on a Chinese-locale Windows writes for "CSV", and the
 * most common reason an imported file turns into mojibake.
 */
export function decodeCsvBytes(bytes: Uint8Array): string {
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
        return new TextDecoder('utf-8').decode(bytes.subarray(3))
    if (bytes[0] === 0xff && bytes[1] === 0xfe)
        return new TextDecoder('utf-16le').decode(bytes.subarray(2))
    if (bytes[0] === 0xfe && bytes[1] === 0xff)
        return new TextDecoder('utf-16be').decode(bytes.subarray(2))
    try {
        return new TextDecoder('utf-8', {fatal: true}).decode(bytes)
    } catch {
        return new TextDecoder('gb18030').decode(bytes)
    }
}

/**
 * Split CSV text into records of fields (RFC 4180): fields may be quoted,
 * a quoted field may hold the delimiter, line breaks and `""` for a quote.
 * Records end at CRLF, LF or CR; a trailing line break does not start an
 * empty record. Rows keep their own lengths — nothing is padded.
 */
export function parseCsv(
    text: string,
    delimiter: string = detectDelimiter(text),
    maxRecords = Infinity
): string[][] {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
    const records: string[][] = []
    let record: string[] = []
    let field = ''
    let quoted = false
    // Whether anything has been read since the last record ended, so a
    // trailing line break does not add an empty record.
    let pending = false
    let i = 0
    const endRecord = () => {
        record.push(field)
        records.push(record)
        record = []
        field = ''
        pending = false
    }
    while (i < text.length && records.length < maxRecords) {
        const ch = text[i]
        if (quoted) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"'
                    i += 2
                    continue
                }
                quoted = false
            } else {
                field += ch
            }
            i++
            continue
        }
        if (ch === '"' && field === '') {
            quoted = true
            pending = true
        } else if (ch === delimiter) {
            record.push(field)
            field = ''
            pending = true
        } else if (ch === '\r' || ch === '\n') {
            endRecord()
            if (ch === '\r' && text[i + 1] === '\n') i++
        } else {
            field += ch
            pending = true
        }
        i++
    }
    if (pending && records.length < maxRecords) endRecord()
    return records
}

/**
 * Guess the delimiter from the first records: the candidate that splits
 * them into the same number of fields (more than one) every time, and the
 * most fields among those. Comma when nothing fits — a one-column file.
 */
export function detectDelimiter(text: string): string {
    let best: string = DELIMITERS[0]
    let bestScore = 0
    for (const d of DELIMITERS) {
        const sample = parseCsv(text, d, 20)
        if (sample.length === 0) continue
        const n = sample[0].length
        if (n < 2 || sample.some((r) => r.length !== n)) continue
        if (n > bestScore) {
            best = d
            bestScore = n
        }
    }
    return best
}

/**
 * What to send as a cell's input so the cell holds the field AS DATA.
 * Numbers and TRUE/FALSE are read as such, the way Excel opens a CSV, but a
 * field that would be taken as a formula (`=`) or lose a leading apostrophe
 * is forced to text — importing a file must not run what is in it.
 */
export function csvFieldToInput(field: string): string {
    if (field.startsWith('=') || field.startsWith("'")) return "'" + field
    return field
}

/**
 * A sheet name for an imported file: its base name, minus the characters a
 * sheet name may not contain, cut to Excel's 31, and numbered when `taken`
 * already has it (case-insensitively, as sheet names compare).
 */
export function csvSheetName(
    fileName: string,
    taken: readonly string[]
): string {
    const base =
        fileName
            .replace(/\.[^.]*$/, '')
            .replace(/[[\]:*?/\\]/g, '_')
            .replace(/^'+|'+$/g, '')
            .trim()
            .slice(0, 31) || 'Sheet'
    const lower = new Set(taken.map((n) => n.toLowerCase()))
    if (!lower.has(base.toLowerCase())) return base
    for (let k = 2; ; k++) {
        const suffix = ` (${k})`
        const name = base.slice(0, 31 - suffix.length) + suffix
        if (!lower.has(name.toLowerCase())) return name
    }
}
