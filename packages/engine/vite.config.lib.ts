/**
 * Library build for logisheets-engine.
 *
 * Produces the self-contained bundle the host app consumes: logisheets-web
 * (and its WASM bindings) are bundled in, so a consumer only needs to import
 * `logisheets-engine` + its stylesheet. The matching WASM binary is copied
 * into dist/assets by the `copy:wasm` script after the build.
 *
 * Output goes to ./dist (gitignored — built in CI / `yarn build`). Plain
 * minification only; the source is open, so there is no obfuscation pass.
 */
import {defineConfig} from 'vite'
import {svelte} from '@sveltejs/vite-plugin-svelte'
import {resolve} from 'path'

export default defineConfig({
    plugins: [
        svelte({
            compilerOptions: {
                customElement: false,
            },
        }),
    ],
    resolve: {
        alias: {
            $lib: '/src/lib',
            $types: '/src/types',
        },
        conditions: ['browser', 'import', 'module', 'default'],
    },
    worker: {
        format: 'es',
        // Worker is not minified-mangled the same way — keep it plain so the
        // WASM bindings it imports keep their expected shape.
        plugins: () => [svelte()],
    },
    build: {
        target: 'esnext',
        sourcemap: false,
        outDir: resolve(__dirname, 'dist'),
        emptyOutDir: true,
        lib: {
            entry: './src/lib/global.ts',
            name: 'LogiSheetsEngine',
            formats: ['es', 'umd'],
            fileName: (format) => `logisheets-engine.${format}.js`,
        },
        rollupOptions: {
            // logisheets-web is bundled (not external) — it carries the WASM
            // bindings the worker needs.
            //
            // echarts is the exception: it is marked external so it is NOT
            // pulled into this bundle. Two reasons — (1) the terser
            // `mangle.properties /^_/` pass below would rename echarts' many
            // `_`-prefixed internals and break it at runtime; (2) keeping it
            // external lets the *consumer's* bundler tree-shake echarts down to
            // the modules registered in src/lib/chart/echarts.ts. It stays a
            // regular dependency, so it is still auto-installed — consumers do
            // not need to add it themselves.
            external: (id) => id === 'echarts' || id.startsWith('echarts/'),
            output: {
                // UMD consumers must provide echarts as a global named
                // `echarts`. ESM consumers resolve the bare imports normally.
                globals: (id) =>
                    id === 'echarts' || id.startsWith('echarts/')
                        ? 'echarts'
                        : '',
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === 'style.css') {
                        return 'logisheets-engine.css'
                    }
                    return assetInfo.name || 'asset'
                },
            },
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true,
                passes: 3,
                pure_funcs: ['console.log', 'console.info', 'console.debug'],
            },
            mangle: {
                properties: {
                    regex: /^_/,
                },
            },
            format: {
                comments: false,
            },
        },
    },
})
