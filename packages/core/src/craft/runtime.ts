import type {Result} from 'logisheets-web'
import type {JsonRpcRequest, JsonRpcResponse} from './rpc.js'

/**
 * A craft's persisted state. It is always a JSON object (the craft serializes
 * it to a string for storage in AppData, and the host treats that string as
 * opaque). Craft authors narrow this by supplying their own type argument to
 * {@link CraftRuntime}.
 */
export type CraftState = Record<string, unknown>

/**
 * The headless logic of a craft, reconstructed by a host from a workbook's
 * persisted craft state.
 *
 * `S` is the craft's own state shape (defaults to a generic JSON object,
 * {@link CraftState}). `W` is the host's workbook handle — logisheets-core is
 * host-neutral and does not know the concrete type, so each host binds it: the
 * Node runtime to its `Workbook`, the browser to its craft workbook wrapper.
 */
export interface CraftRuntime<S extends CraftState = CraftState, W = unknown> {
    onLoad: (s: S, wb: W) => Result<void>
    onRequest: (req: JsonRpcRequest, s: S, wb: W) => Result<void>
    onResponse: (resp: JsonRpcResponse, s: S, wb: W) => Result<void>
}
