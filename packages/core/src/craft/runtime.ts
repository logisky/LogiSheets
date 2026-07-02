import type {Result} from 'logisheets-web'
import type {Violation} from '../validation/index.js'
import type {JsonRpcRequest, JsonRpcResponse} from './rpc.js'

/**
 * A craft's persisted state. It is always a JSON object (the craft serializes
 * it to a string for storage in AppData, and the host treats that string as
 * opaque). Craft authors narrow this by supplying their own type argument to
 * {@link CraftRuntime}.
 */
export type CraftState = Record<string, unknown>

/**
 * A lifecycle hook may run engine operations, which are async on every host.
 * So every hook may return its {@link Result} directly or a promise of it; the
 * host always awaits before inspecting the value.
 */
export type MaybePromise<T> = T | Promise<T>

/**
 * The headless logic of a craft, reconstructed by a host from a workbook's
 * persisted craft state.
 *
 * `S` is the craft's own state shape (defaults to a generic JSON object,
 * {@link CraftState}). `W` is the host's workbook handle — logisheets-core is
 * host-neutral and does not know the concrete type, so each host binds it: the
 * Node runtime to its `Workbook`, the browser to its craft workbook wrapper.
 *
 * The hooks fire around a single JSON-RPC exchange in this order:
 *
 *   onLoad      once, when the workbook is opened — rehydrate from state
 *   onRequest   inputs of an incoming request are about to be applied
 *   onValidate  inputs are now in place; check them BEFORE a response is read
 *   onResponse  the response has been produced and is about to be returned
 */
export interface CraftRuntime<S extends CraftState = CraftState, W = unknown> {
    onLoad: (s: S, wb: W) => MaybePromise<Result<void>>
    onRequest: (req: JsonRpcRequest, s: S, wb: W) => MaybePromise<Result<void>>

    /**
     * Called once an RPC request's inputs have been written into the workbook
     * but BEFORE its response is read back — the gateway's validation
     * checkpoint. Returns the cells that fail their rules (empty when all
     * pass). A host that gets a non-empty result should reject the request and
     * roll the inputs back rather than return a response computed from invalid
     * input. Optional: a craft with no validation needs simply omits it.
     */
    onValidate?: (s: S, wb: W) => MaybePromise<Result<readonly Violation[]>>

    onResponse: (resp: JsonRpcResponse, s: S, wb: W) => MaybePromise<Result<void>>
}
