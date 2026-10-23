# Data connections

`dataConnections` is a host capability: a craft asks the host to run SQL
against a database the **user** configured, and gets typed rows back. The
craft never sees a password, and never opens a socket.

Phase 1 is **desktop only** and supports **PostgreSQL, MySQL/MariaDB and
SQLite**, read-only.

A craft that needs it declares so in `package.json`:

```json
{ "craftRequires": ["dataConnections"] }
```

On a host without the capability (the web build today) Browse lists the craft
as *needs database connections* and refuses to install it. The craft must still
check `window.dataConnections` at runtime — a capability can be withdrawn, and
a craft loaded from source during development skips the install check.

## Why it has to be native

A webview cannot open a raw TCP connection, and the Postgres and MySQL wire
protocols are not HTTP. So the connection lives in the Tauri process, the same
way `llm_fetch` (`packages/desktop/src-tauri/src/net.rs`) runs HTTP natively.

```
craft iframe ──window.dataConnections──▶ host (craft panel)
                                            │ __TAURI_INTERNALS__.invoke
                                            ▼
                               Tauri  db.rs ── sqlx ──▶ Postgres / MySQL / SQLite
                                 │
              metadata ──────────┤ app-data/data-connections.json
              password ──────────┘ OS keychain (keyring crate)
```

## Where things are stored

| What | Where | Ever reaches JS? |
|---|---|---|
| name, kind, host, port, database, user, SSL mode | `data-connections.json` in the app-data dir | yes |
| password | OS keychain: service `logisheets.data-connections`, account = connection id | **never** |
| the craft's query text, target block | craft state (rides the .xlsx) | yes |

Credentials never go into craft state (it is saved in the workbook and travels
with the file) and never into `craftStorage` (plaintext on disk). A workbook
refers to a connection only by its **id**; opened on another machine, the id
resolves to nothing and the craft asks the user to pick a connection.

The password is **write-only** from JS: `db_conn_save` accepts one, nothing
returns one. The listing carries `hasPassword: boolean` instead.

## Craft API — `window.dataConnections`

Contract: `packages/core/src/craft/data-connections.ts`. Host side:
`src/core/data-connections/` (the Tauri bridge) and the craft panel, which
injects it; `hostCapabilities()` advertises `dataConnections` exactly where the
bridge exists.

```ts
interface DataConnections {
    /** Saved connections, without secrets. */
    list(): Promise<DataConnectionInfo[]>
    /** Open a connection to check it works. Resolves; never rejects on a
     *  database error — `{ok: false, error}` instead. */
    test(connId: string): Promise<{ok: boolean; error?: string}>
    /** Run one read-only statement. Rejects with a readable message. */
    query(connId: string, sql: string, opts?: QueryOptions): Promise<QueryResult>
    /** Open the host's connection manager (add / edit / delete). */
    openManager(): void
}

interface DataConnectionInfo {
    id: string
    name: string
    kind: 'postgres' | 'mysql' | 'sqlite'
    host: string          // '' for sqlite
    port: number          // 0 for sqlite
    database: string      // file path for sqlite
    user: string
    sslMode: 'disable' | 'prefer' | 'require'
    hasPassword: boolean
}

interface QueryOptions {
    params?: (string | number | boolean | null)[]   // $1 / ? placeholders
    maxRows?: number      // default 10 000, capped at 100 000
    timeoutMs?: number    // default 30 000, capped at 600 000
}

interface QueryResult {
    columns: {name: string; type: ColumnType; dbType: string}[]
    rows: CellValue[][]   // row-major, one entry per column
    truncated: boolean    // more rows existed than maxRows
}

type ColumnType = 'number' | 'text' | 'boolean' | 'date' | 'datetime' | 'time'
type CellValue = string | number | boolean | null
```

Crafts get **list / test / query / openManager** only. Saving and deleting a
connection is the host UI's job (it is where the user types a password).

## Type mapping

Every value has one rule, decided in Rust, so every craft sees the same thing.

| Database type | `type` | Value |
|---|---|---|
| NULL (any column) | — | `null` → write an **empty cell**, not `""` |
| SMALLINT, INT, REAL, DOUBLE | `number` | JS number |
| BIGINT within ±2^53 | `number` | JS number |
| BIGINT beyond ±2^53, UNSIGNED BIGINT beyond 2^53 | `number` | **decimal string** (exact) |
| NUMERIC / DECIMAL | `number` | **decimal string** (exact, as the server printed it) |
| BOOLEAN / BOOL | `boolean` | `true` / `false` |
| DATE | `date` | `"YYYY-MM-DD"` |
| TIME | `time` | `"HH:MM:SS[.ffffff]"` |
| TIMESTAMP, DATETIME (no zone) | `datetime` | `"YYYY-MM-DDTHH:MM:SS[.ffffff]"` — wall clock as stored, **no offset** |
| TIMESTAMPTZ, MySQL TIMESTAMP | `datetime` | converted to **UTC**, `"…Z"` |
| CHAR, VARCHAR, TEXT, ENUM, UUID, JSON | `text` | string |
| BYTEA, BLOB | `text` | `"base64:…"` |
| anything else | `text` | the server's text form when it has one, else an error naming the column type |

`number`-typed strings are a promise: the craft may parse them, but a decimal
string written into a cell as text keeps every digit, which is usually the
point of a DECIMAL column. SQLite is dynamically typed; its column type comes
from the declared type and, for expressions, from the first non-NULL value.

## Guardrails on every query

- **Read-only.** Postgres `BEGIN READ ONLY`. MySQL
  `SET SESSION TRANSACTION READ ONLY` plus `START TRANSACTION READ ONLY` — the
  session setting matters because DDL commits implicitly and would otherwise
  run outside the transaction. SQLite is opened `SQLITE_OPEN_READONLY` with
  `PRAGMA query_only`, and a missing file is an error, not a new database.
  Always rolled back.
- **Row cap.** Rows are streamed; reading stops at `maxRows` and `truncated`
  says whether more existed. The whole result is held in memory, so the cap is
  also the memory bound.
- **Timeout.** A client-side deadline drops the connection, plus a server-side
  one where the database has it (Postgres `statement_timeout`, MySQL
  `max_execution_time`) so the server stops working too.
- **One statement.** Postgres and MySQL reject multi-statement strings on the
  prepared-statement path; SQLite's read-only handle makes extra statements
  harmless.
- **One connection per query.** Phase 1 does not pool: connect, run, close.

## Trust model

Installed crafts run with full trust in a same-origin iframe. Any of them could
call `__TAURI_INTERNALS__.invoke('db_query', …)` directly, skipping
`window.dataConnections`. So:

- **The keychain protects the secret, not its use.** No craft can read a
  password; **any installed craft can run a query on any saved connection**.
- **Read-only is a guardrail, not a security boundary.** A read-only
  transaction stops ordinary writes, but a function with side effects, a
  MySQL temporary table or a server extension may still act. Give LogiSheets
  a database user that has only the grants you mean it to have.
- Install crafts that need `dataConnections` only from sources you trust.

## Host UI

A **Connections** tab in the craft manager (desktop only) to add, edit, test
and delete connections. Editing leaves the password field empty; leaving it
empty keeps the stored one. A craft opens the same tab with
`dataConnections.openManager()`.

## Tauri commands

Plain app commands, invoked through `window.__TAURI_INTERNALS__.invoke` — no
`@tauri-apps` npm dependency.

| Command | Args | Returns |
|---|---|---|
| `db_conn_list` | — | `DataConnectionInfo[]` |
| `db_conn_save` | `conn` (id empty = new), `password?: string` (absent or empty = keep), `clearPassword?: boolean` | the saved `DataConnectionInfo` |
| `db_conn_delete` | `connId` | — (also removes the keychain entry) |
| `db_conn_test` | `conn`, `password?` — tests unsaved form values; absent password uses the keychain | `{ok, error?}` |
| `db_query` | `connId, sql, params, maxRows, timeoutMs` | `QueryResult` |

## Out of scope for phase 1

- **The web build.** It would need a server-side proxy holding credentials,
  which is a product of its own. Crafts already ask for the capability, not a
  platform, so such a host can add it later without republishing crafts.
- **A server-side query proxy** of any kind.
- **MSSQL, Oracle**, and other drivers sqlx does not ship.
- **SSH tunnels**, client certificates, Kerberos/IAM auth.
- **Writing** to the database, connection pooling, scheduled refresh, and
  per-craft grants on connections.

## Example craft

`sql-query` in the craft registry (`../crafts/packages/sql-query`): pick a
connection, write SQL, run it into a typed block, run again to refresh. Its
README records how values become cells (NULL stays empty, text that would parse
as a number or formula is kept as text, dates go in as serials with a field
number format) and why a refresh writes a new block id and ref name.
