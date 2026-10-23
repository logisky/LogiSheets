import type {
    DataConnectionInfo,
    DataConnectionsBackend,
    DataConnectionTestResult,
    DataQueryOptions,
    DataQueryResult,
} from 'logisheets-core'
import {isTauri, tauriInvoke} from '@/core/tauri'

/**
 * Desktop backend: the `db_*` commands in
 * packages/desktop/src-tauri/src/db.rs. The password goes in and never comes
 * back out.
 */
class TauriDataConnectionsBackend implements DataConnectionsBackend {
    list(): Promise<DataConnectionInfo[]> {
        return tauriInvoke('db_conn_list')
    }

    save(
        conn: DataConnectionInfo,
        password?: string,
        clearPassword?: boolean
    ): Promise<DataConnectionInfo> {
        return tauriInvoke('db_conn_save', {conn, password, clearPassword})
    }

    delete(connId: string): Promise<void> {
        return tauriInvoke('db_conn_delete', {connId})
    }

    test(
        conn: DataConnectionInfo,
        password?: string
    ): Promise<DataConnectionTestResult> {
        return tauriInvoke('db_conn_test', {conn, password})
    }

    query(
        connId: string,
        sql: string,
        opts: DataQueryOptions = {}
    ): Promise<DataQueryResult> {
        return tauriInvoke('db_query', {
            connId,
            sql,
            params: opts.params ?? [],
            maxRows: opts.maxRows,
            timeoutMs: opts.timeoutMs,
        })
    }
}

let tauriBackend: DataConnectionsBackend | undefined

/**
 * This host's data-connections backend, or `null` where there is none (the
 * web build). Must agree with `hostCapabilities()`, which checks the same
 * thing.
 */
export function getDataConnectionsBackend(): DataConnectionsBackend | null {
    if (!isTauri()) return null
    tauriBackend ??= new TauriDataConnectionsBackend()
    return tauriBackend
}
