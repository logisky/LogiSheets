import {defineConfig} from 'vitest/config'

// `__tests__/packaging.test.ts` alone, run by `yarn test:packaging`.
//
// It is kept out of the default config because it is a different kind of test:
// it packs and unpacks tarballs and shells out to npm, tar and node, while
// every other file in __tests__ stands up a WASM engine. Sharing a worker pool
// on a 2-core CI runner starved this one's setup past its hook timeout, so it
// gets the machine to itself — and its own CI step, so a failure reads as
// "publishing is broken" rather than "the Node bindings are broken".
export default defineConfig({
    test: {
        include: ['__tests__/packaging.test.ts'],
        // Setup packs ~20MB of wasm across four tarballs; CI runners are slow.
        hookTimeout: 600_000,
        testTimeout: 120_000,
    },
})
