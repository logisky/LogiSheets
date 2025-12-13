import {defineConfig} from 'vite'
import path from 'node:path'

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/index.ts'),
            name: 'WhatIfCalculator',
            fileName: () => 'what-if-calculator.js',
            formats: ['umd'],
        },
        target: 'es2018',
        sourcemap: false,
        minify: false,
    },
})
