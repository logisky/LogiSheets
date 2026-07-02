// data-gateway craft — web (UMD) entry point.
//
// This bundle is loaded by the craft iframe's index.html. It exposes the state
// schema helpers and the UI mount function on the UMD global `DataGateway`, so
// the page can bootstrap the authoring UI against the host-injected globals:
//
//   <script src="./data-gateway.js"></script>
//   <script>DataGateway.mount(document.getElementById('root'), window)</script>
//
// The headless runtime face lives in ./runtime (see runtime.ts) and is bundled
// separately for the Node host — it is intentionally NOT part of this UI bundle.

export const NAME = 'data-gateway'

export * from './state'
export {mount, type GatewayWindow} from './ui'
