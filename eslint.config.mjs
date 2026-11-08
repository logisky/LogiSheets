import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import globals from 'globals'

const useAppDialog =
    "Use the app's dialog from '@/ui/dialog' (same names and props as MUI's): it carries the shared rounded, hairline look. Stock MUI dialogs drift from the rest of the app."

export default tseslint.config(
    {
        // Flat config does not read .gitignore, and unlike eslintrc it would
        // otherwise walk build output, Rust targets and agent worktrees.
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/target/**',
            '.claude/**',
            '.yarn/**',
            'src/bindings/**',
            'crates/wasms/**',
            'packages/**/bindings/**',
            'packages/**/wasm/**',
            // A build-time copy of packages/web/src (packages/node `link`).
            'packages/node/src/**',
            // Built craft bundles (gitignored) and the docs build cache.
            'public/**',
            'docs/.vitepress/cache/**',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    react.configs.flat.recommended,
    prettierRecommended,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
        },
        settings: {react: {version: 'detect'}},
        rules: {
            'max-lines': 'off',
            'react/react-in-jsx-scope': 'off',
            'no-console': 'error',
            'no-alert': 'error',
            'no-debugger': 'error',
            'react/self-closing-comp': 'error',
            // A warning, not an error: the deliberate exceptions carry a
            // disable comment, and eslint --fix strips disable comments for
            // rules that are not enabled.
            'react-hooks/exhaustive-deps': 'warn',
            '@typescript-eslint/no-unused-vars': 'off',
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: '@mui/material',
                            importNames: [
                                'Dialog',
                                'DialogTitle',
                                'DialogContent',
                                'DialogContentText',
                                'DialogActions',
                            ],
                            message: useAppDialog,
                        },
                        {name: 'react-modal', message: useAppDialog},
                    ],
                    patterns: [
                        {
                            group: [
                                '@mui/material/Dialog',
                                '@mui/material/DialogTitle',
                                '@mui/material/DialogContent',
                                '@mui/material/DialogContentText',
                                '@mui/material/DialogActions',
                            ],
                            message: useAppDialog,
                        },
                    ],
                },
            ],
        },
    },
    {
        // Node-side code: build scripts, configs, CLIs, e2e drivers. Printing
        // is how these talk to the person running them.
        files: [
            'scripts/**',
            'packages/*/scripts/**',
            'packages/craftsmith/**',
            'e2e/**',
            'docs/.vitepress/**',
            '*.config.{js,mjs,ts}',
        ],
        languageOptions: {globals: globals.node},
        rules: {'no-console': 'off'},
    },
    {
        // The engine's worker RPC boundary passes untyped payloads by design,
        // and a library warns its host through the console (the production
        // build drops log/info/debug but keeps these).
        files: ['packages/engine/src/**'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            'no-console': ['error', {allow: ['warn', 'error']}],
        },
    },
    {
        // e2e specs reach into the page's globals.
        files: ['e2e/**'],
        rules: {'@typescript-eslint/no-explicit-any': 'off'},
    },
    {
        files: ['src/ui/dialog/**'],
        rules: {'no-restricted-imports': 'off'},
    }
)
