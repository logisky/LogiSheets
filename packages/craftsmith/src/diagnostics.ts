/**
 * `'error'` makes check / build exit 1 (build then writes nothing); `'warn'`
 * is printed only.
 */
export type DiagnosticLevel = 'error' | 'warn'

/** One finding from `extract`. Diagnostics are data — extract never prints. */
export interface Diagnostic {
    level: DiagnosticLevel
    message: string
    /** Absolute file path, if the diagnostic is anchored to source. */
    file?: string
    /**
     * 1-based line of the offending node (its first token, not its
     * JSDoc). Absent for file-level findings.
     */
    line?: number
}

/** Thrown by the schema mapper when a TS type can't become JSON Schema. */
export class SchemaError extends Error {}
