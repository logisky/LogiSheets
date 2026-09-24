// The dependency seam.
//
// logisheets-core is pure logic and must not bundle a backend. It talks to
// the engine ONLY through the `Client` interface, which it imports as a TYPE
// from logisheets-web. `import type` is erased at compile time, so this file
// produces NO runtime dependency on logisheets-web (or on logisheets-node).
//
// The concrete Client is INJECTED by the host:
//   - browser app   -> logisheets-engine's worker-backed WorkbookClient
//   - node runtime  -> logisheets-runtime's Proxy over the Node WASM handle(),
//                      with each synchronous result wrapped in a Promise
//
// Both implement the same `Client` interface, so logisheets-core never needs
// to know which one it got. (The Node proxy leaves the `register*` callback
// members unimplemented; core code must not depend on them.)

import type {Client} from 'logisheets-web'

export type {Client}

/**
 * Anything in logisheets-core that needs to reach the engine takes one of
 * these instead of importing a concrete client. Tests pass a mock.
 */
export interface HasClient {
    readonly client: Client
}
