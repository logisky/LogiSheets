import {defineConfig, devices} from '@playwright/test'

// Dedicated port so the e2e server never clashes with a dev server you may
// already have running on 4200.
const PORT = Number(process.env.E2E_PORT) || 4288
const BASE_URL = `http://localhost:${PORT}`

// The webpack dev server does NOT rebuild `logisheets-engine` — the app imports
// its prebuilt `dist`. So by default we rebuild the engine before serving, so
// the tests always run against the current engine source. Set `E2E_NO_BUILD=1`
// to skip the rebuild for fast iteration when only the app (`src/`) changed.
const serveCommand = process.env.E2E_NO_BUILD
    ? `PORT=${PORT} yarn start:dev`
    : `yarn workspace logisheets-engine build && PORT=${PORT} yarn start:dev`

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: 'list',
    timeout: 45_000,
    expect: {timeout: 15_000},
    use: {
        baseURL: BASE_URL,
        trace: 'on-first-retry',
    },
    projects: [{name: 'chromium', use: {...devices['Desktop Chrome']}}],
    webServer: {
        command: serveCommand,
        url: BASE_URL,
        // Always start a fresh server (and a freshly built engine) for the run.
        reuseExistingServer: false,
        timeout: 300_000,
        stdout: 'pipe',
        stderr: 'pipe',
    },
})
