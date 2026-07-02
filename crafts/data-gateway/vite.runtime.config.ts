import {defineConfig} from 'vite'
import path from 'node:path'

// Builds the headless runtime face (src/runtime.ts) as an ES module for the
// Node host to import(). logisheets-core / logisheets-web are provided by the
// host at runtime, so they stay external rather than being bundled in.
export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/runtime.ts'),
            fileName: () => 'data-gateway.runtime.js',
            formats: ['es'],
        },
        target: 'es2018',
        sourcemap: false,
        minify: false,
        emptyOutDir: false,
        rollupOptions: {
            external: ['logisheets-core', 'logisheets-web'],
        },
    },
})
