import {resolve} from 'path'
import {defineConfig, configDefaults} from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        // Keep the built-in ignores (node_modules, dist, …) and also skip the
        // direnv/Nix input tree and Rust/build output so their vendored test
        // files aren't collected.
        exclude: [...configDefaults.exclude, '.direnv/**', 'target/**'],
        alias: {
            '@': resolve('src'),
        },
    },
})
