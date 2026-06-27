import {defineConfig} from 'vite'
import {svelte} from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
    plugins: [svelte()],
    resolve: {
        alias: {
            $lib: '/src/lib',
            $types: '/src/types',
        },
        conditions: ['browser', 'import', 'module', 'default'],
    },
    worker: {
        format: 'es',
    },
    build: {
        target: 'esnext',
        sourcemap: true,
    },
    optimizeDeps: {
        exclude: ['logisheets-web'],
    },
    server: {
        fs: {
            // Allow serving files from the parent LogiSheets directory (for WASM files)
            allow: ['.', '../LogiSheets'],
        },
    },
})
