export type DiagnosticLevel = 'error' | 'warn'

export interface Diagnostic {
    level: DiagnosticLevel
    message: string
    /** Absolute file path, if the diagnostic is anchored to source. */
    file?: string
    /** 1-based line number. */
    line?: number
}

/** Thrown by the schema mapper when a TS type can't become JSON Schema. */
export class SchemaError extends Error {}
