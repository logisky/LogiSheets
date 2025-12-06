import {defineConfig} from 'vite'
import path from 'node:path'

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/index.ts'),
            name: 'MarkdownTableExtractor',
            fileName: () => 'markdown-table-extractor.js',
            formats: ['umd'],
        },
        // 不配置 external，直接把 unified/remark 相关依赖都打进一个 bundle 里
        target: 'es2018',
        sourcemap: false,
        minify: false,
    },
})
