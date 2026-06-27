import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import {resolve} from 'path'

export default defineConfig({
    plugins: [
        react(),
        dts({
            include: ['src/lib'],
            outDir: 'dist',
        }),
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    build: {
        lib: {
            // Two entries: `index` (includes the React wrapper) and `core`
            // (framework-agnostic, no React). Consumers pick via subpath.
            entry: {
                index: resolve(__dirname, 'src/lib/index.ts'),
                core: resolve(__dirname, 'src/lib/core.ts'),
                engine: resolve(__dirname, 'src/lib/engine.ts'),
                inline: resolve(__dirname, 'src/lib/inline.ts'),
            },
            formats: ['es'],
        },
        rollupOptions: {
            // logisheets-engine is a peer (only the /inline entry uses it).
            external: [
                'react',
                'react-dom',
                'react/jsx-runtime',
                'logisheets-engine',
            ],
            output: {
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM',
                },
            },
        },
    },
})
