import {defineConfig, configDefaults} from 'vitest/config'

export default defineConfig({
    test: {
        include: ['__tests__/**/*.test.ts'],
        // packaging.test.ts runs on its own — see vitest.packaging.config.ts.
        exclude: [...configDefaults.exclude, '__tests__/packaging.test.ts'],
    },
})
