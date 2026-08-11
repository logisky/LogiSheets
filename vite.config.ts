import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import checker from 'vite-plugin-checker'
import * as path from 'path'
import * as fs from 'fs'

// Which crafts the panel offers is driven by crafts.config.json + the
// CRAFT_DIST env var (default: "default"). See crafts.config.json. (Mirrors
// what the old webpack config injected via DefinePlugin.)
function resolveCraftTools(): {
    tools: {label: string; value: string}[]
    defaultCraft: string
} {
    const cfg = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, 'crafts.config.json'), 'utf8')
    )
    const name = process.env.CRAFT_DIST || 'default'
    const dist = cfg.distributions[name] ?? cfg.distributions.default
    const dirs: string[] =
        dist.crafts === 'all' ? Object.keys(cfg.registry) : dist.crafts
    const tools = dirs.map((d: string) => ({
        label: cfg.registry[d].label as string,
        value: `/${d}/index.html`,
    }))
    const defaultCraft = dist.defaultCraft
        ? `/${dist.defaultCraft}/index.html`
        : tools[0]?.value ?? '/factory-simulator-en/index.html'
    return {tools, defaultCraft}
}

export default defineConfig(() => {
    const craft = resolveCraftTools()
    return {
        // Keep function/class names through minification. The prebuilt engine's
        // inlined Web Worker relies on names surviving; esbuild's default
        // identifier mangling breaks its rendering in the production build.
        esbuild: {keepNames: true},
        plugins: [
            react(),
            // Type-check in dev + build (parity with the old
            // ForkTsCheckerWebpackPlugin).
            checker({typescript: {tsconfigPath: './tsconfig.json'}}),
        ],
        resolve: {
            alias: [
                {find: '@', replacement: path.resolve(__dirname, 'src')},
                // Exact matches (the `$` in the old webpack alias) so subpath
                // imports aren't swallowed.
                {
                    find: /^logisheets-formula-editor$/,
                    replacement: path.resolve(
                        __dirname,
                        'packages/formula-editor/src/lib/index.ts'
                    ),
                },
                {
                    find: /^logisheets-formula-editor\/inline$/,
                    replacement: path.resolve(
                        __dirname,
                        'packages/formula-editor/src/lib/inline.ts'
                    ),
                },
            ],
        },
        define: {
            __CRAFT_TOOLS__: JSON.stringify(craft.tools),
            __DEFAULT_CRAFT__: JSON.stringify(craft.defaultCraft),
        },
        // PORT env keeps the contract the webpack dev server had (Playwright
        // e2e passes PORT=<n>).
        server: {port: Number(process.env.PORT) || 4200},
        build: {
            outDir: 'dist',
            // The prebuilt logisheets-engine bundle is ~19MB (it inlines its
            // worker + WASM as data URIs), so silence the chunk-size warning.
            chunkSizeWarningLimit: 30000,
            // Keep the engine's ~7MB WASM data-URI INLINED. If rollup extracts
            // it to a /assets/*.wasm file, the engine's inlined Web Worker (a
            // blob: URL) can't resolve the rewritten asset path against its
            // blob import.meta.url, so the worker's WASM never loads and the
            // grid renders in a broken/partial state. Inlining (like the old
            // webpack `parser:{url:false}`) keeps the data URI intact.
            assetsInlineLimit: 20_000_000,
        },
        // Don't let esbuild's dep pre-bundler touch the giant engine bundle
        // (its inlined ~8MB data-URI WASM tripped webpack; skip pre-bundling it
        // and let the browser resolve the data: URL itself).
        optimizeDeps: {exclude: ['logisheets-engine']},
    }
})
