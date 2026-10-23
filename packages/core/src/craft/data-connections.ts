// Data connections: a craft runs SQL against a database the USER configured in
// the host, and gets typed rows back. See docs/craft/data-connections.md.
//
// The database protocols run natively (the desktop app's src-tauri/src/db.rs);
// a webview cannot open raw TCP. Connection metadata lives in the app-data
// directory and the password in the OS keychain: no password ever reaches JS,
// and nothing here is saved in the workbook. A workbook that remembers a
// connection remembers its `id` only, which resolves to nothing on another
// machine.
//
// Trust: installed crafts are full trust, so ANY craft can query ANY saved
// connection. The keychain protects the secret, not its use, and the read-only
// transaction is a guardrail, not a security boundary.

export type DataConnectionKind = 'postgres' | 'mysql' | 'sqlite'

export type DataConnectionSslMode = 'disable' | 'prefer' | 'require'

/** A saved connection. Never carries a password. */
export interface DataConnectionInfo {
    id: string
    name: string
    kind: DataConnectionKind
    /** '' for sqlite. */
    host: string
    /** 0 for sqlite. */
    port: number
    /** The database name, or the file path for sqlite. */
    database: string
    user: string
    sslMode: DataConnectionSslMode
    /** A password is stored in the keychain for this connection. */
    hasPassword: boolean
}

/**
 * How a column's values should be read:
 * - `number`: a JS number, OR a decimal string when the value is exact and a
 *   JS number cannot hold it (NUMERIC/DECIMAL always; BIGINT beyond ±2^53).
 * - `date`: `YYYY-MM-DD`. `time`: `HH:MM:SS[.fff]`.
 * - `datetime`: `YYYY-MM-DDTHH:MM:SS[.fff]`, with a `Z` (converted to UTC)
 *   when the database type has a zone, and no offset (wall clock as stored)
 *   when it does not.
 * - `text`: anything else; binary values are `base64:…`.
 */
export type DataColumnType =
    | 'number'
    | 'text'
    | 'boolean'
    | 'date'
    | 'datetime'
    | 'time'

/** `null` is an EMPTY cell, which is not the same as `''`. */
export type DataCellValue = string | number | boolean | null

export interface DataColumn {
    name: string
    type: DataColumnType
    /** The database's own name for the type, for display. */
    dbType: string
}

export interface DataQueryResult {
    columns: DataColumn[]
    /** Row-major, one entry per column. */
    rows: DataCellValue[][]
    /** More rows existed than `maxRows`. */
    truncated: boolean
}

export interface DataQueryOptions {
    /** Bound to `$1…` (Postgres) or `?` (MySQL, SQLite), typed by JS type. */
    params?: DataCellValue[]
    /** Default 10 000, capped at 100 000. */
    maxRows?: number
    /** Default 30 000, capped at 600 000. Covers connecting too. */
    timeoutMs?: number
}

export interface DataConnectionTestResult {
    ok: boolean
    error?: string
}

/**
 * The craft-facing API, injected as `window.dataConnections` on hosts that
 * provide the `dataConnections` capability. Absent elsewhere: a craft must
 * check for it at runtime even when it declared `craftRequires`.
 *
 * Saving and deleting connections is deliberately NOT here: the host UI is
 * where the user types a password.
 */
export interface DataConnections {
    /** Saved connections, without secrets. */
    list(): Promise<DataConnectionInfo[]>
    /** Resolves `{ok: false, error}` on a database error; never rejects for one. */
    test(connId: string): Promise<DataConnectionTestResult>
    /**
     * Run ONE statement in a read-only transaction. Rejects with a readable
     * message (bad SQL, unreachable server, timeout, a column type with no
     * cell mapping — cast it to text in the query).
     */
    query(
        connId: string,
        sql: string,
        opts?: DataQueryOptions
    ): Promise<DataQueryResult>
    /** Open the host's connection manager so the user can add one. */
    openManager(): void
}

/**
 * The host-side store behind both the craft API and the host's own
 * connection UI. Implemented app-side (the Tauri bridge); core only defines
 * the seam, as with {@link CraftStorageBackend}.
 */
export interface DataConnectionsBackend {
    list(): Promise<DataConnectionInfo[]>
    /**
     * Create (`id` empty) or update a connection. `password` absent keeps the
     * stored one; `clearPassword` removes it. Returns the saved connection.
     */
    save(
        conn: DataConnectionInfo,
        password?: string,
        clearPassword?: boolean
    ): Promise<DataConnectionInfo>
    /** Also removes the keychain entry. */
    delete(connId: string): Promise<void>
    /**
     * Test possibly-unsaved form values. Without `password`, a saved
     * connection's keychain entry is used.
     */
    test(
        conn: DataConnectionInfo,
        password?: string
    ): Promise<DataConnectionTestResult>
    query(
        connId: string,
        sql: string,
        opts?: DataQueryOptions
    ): Promise<DataQueryResult>
}

/** Build the craft-facing handle over a host backend. */
export function makeDataConnections(
    backend: DataConnectionsBackend,
    openManager: () => void
): DataConnections {
    return {
        list: () => backend.list(),
        test: async (connId) => {
            const conn = (await backend.list()).find((c) => c.id === connId)
            if (!conn)
                return {
                    ok: false,
                    error: `no data connection with id ${connId}`,
                }
            return backend.test(conn)
        },
        query: (connId, sql, opts) => backend.query(connId, sql, opts),
        openManager,
    }
}
