import {resolve} from 'path'
import {defineConfig, configDefaults} from 'vitest/config'

// Dedicated Vitest config so the unit tests stay decoupled from the app's
// build config (vite.config.ts, which carries the React + checker plugins and
// the engine-specific build tweaks). Vitest prefers this file over
// vite.config.ts, so `yarn test` runs with exactly this setup.
export default defineConfig({
    test: {
        globals: true,
        // `yarn test` (this root config) covers the root app (src/) and the
        // craft sources. Each workspace under packages/* has its OWN Vitest
        // config + `test` script (e.g. `yarn workspace logisheets-web test`),
        // which supplies the setup those suites need — notably the real-WASM
        // init in packages/web/__tests__/setup.ts. CI runs those per-package
        // scripts (see .github/workflows/rust.yaml), so collecting them here
        // (without their setup) would only produce false failures. Also skip
        // the Playwright e2e specs (run via `yarn test:e2e`) and the
        // direnv/Nix input tree + Rust build output so their vendored test
        // files aren't collected.
        exclude: [
            ...configDefaults.exclude,
            '.direnv/**',
            'target/**',
            'e2e/**',
            'packages/**',
        ],
        alias: {
            '@': resolve('src'),
        },
    },
})
