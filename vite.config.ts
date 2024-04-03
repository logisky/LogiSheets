import { resolve } from 'path'
import {defineConfig} from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        alias: {
            '@': resolve('src')
        }
    }
})