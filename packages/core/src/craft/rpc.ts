// JSON-RPC 2.0 wire types shared across the craft contract.
//
// These describe the envelope a craft's runtime sees in `onRequest` /
// `onResponse` (see ./runtime.ts). They live in logisheets-core — the shared,
// host-neutral layer — so both the craft interface here and the Node host's
// RpcServer (logisheets-runtime) can reference one definition. The host owns
// the transport (HTTP, dispatch, error mapping); these are only the shapes.

export interface JsonRpcRequest {
    jsonrpc: '2.0'
    id?: string | number | null
    method: string
    params?: unknown
}

export interface JsonRpcError {
    code: number
    message: string
    data?: unknown
}

export interface JsonRpcResponse {
    jsonrpc: '2.0'
    id: string | number | null
    result?: unknown
    error?: JsonRpcError
}
