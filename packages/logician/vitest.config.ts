import {defineConfig, configDefaults} from 'vitest/config'

export default defineConfig({
    test: {
        // `tsc` compiles the tests into dist/ alongside the sources, and since
        // Vitest 4 the default exclude no longer skips dist/, so without this
        // every suite would also run a second time from the last build.
        exclude: [...configDefaults.exclude, 'dist/**'],
    },
})
