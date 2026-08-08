import {test, expect, type Page} from '@playwright/test'

/**
 * End-to-end coverage for the craft canvas-input capability.
 *
 * When a craft is active (panel open + selected), the host routes mouse/
 * keyboard events on the spreadsheet canvas THROUGH the craft first — the craft
 * decides, synchronously, whether the engine should still handle each one (see
 * `packages/core/src/craft/events.ts`, `src/core/craft-input/use-interception.ts`,
 * and the `window.onCanvasInput` injection in the craft panel).
 *
 * These tests exercise the real wiring: they open the real craft panel (so the
 * real active-craft gating runs), register a handler exactly as a craft would —
 * via the injected `window.onCanvasInput` on the craft iframe — and then drive
 * REAL (trusted) mouse/keyboard input. A probe listener on the engine's canvas
 * tells us whether an event actually reached the engine: our capture-phase
 * consume calls `stopImmediatePropagation`, so if the craft consumed it, neither
 * the engine's handler nor the probe fires.
 */

const canvas = (page: Page) => page.locator('canvas.main-canvas').first()

async function waitForGrid(page: Page) {
    await expect(page.locator('canvas').first()).toBeVisible({timeout: 30_000})
    await expect(
        page.locator('.row-header').filter({hasText: /^1$/})
    ).toBeVisible({timeout: 30_000})
}

// Open the panel and register a test handler on the active craft's iframe,
// exactly where a real craft would call `window.onCanvasInput`. The handler
// records every event and consumes based on `window.__consume`. A probe on the
// canvas records whether the event reached the engine.
async function installCraftHandler(page: Page) {
    await page.getByRole('button', {name: 'Open craft panel'}).click()

    // Wait until the host has injected onCanvasInput onto the craft iframe.
    await page.waitForFunction(() => {
        const f = document.querySelector('iframe') as HTMLIFrameElement | null
        return !!(f && (f.contentWindow as any)?.onCanvasInput)
    }, undefined, {timeout: 30_000})

    await page.evaluate(() => {
        const w = window as any
        w.__ev = []
        w.__reached = false
        w.__consume = false
        const iframe = document.querySelector('iframe') as HTMLIFrameElement
        const cv = document.querySelector('canvas.main-canvas') as HTMLCanvasElement
        const probe = () => {
            w.__reached = true
        }
        cv.addEventListener('mousedown', probe, false)
        cv.addEventListener('keydown', probe, false)
        ;(iframe.contentWindow as any).onCanvasInput((e: any) => {
            w.__ev.push({type: e.type, row: e.row, col: e.col, sheetIdx: e.sheetIdx, key: e.key})
            return w.__consume ? {handled: true} : false
        })
    })
}

async function reset(page: Page, consume: boolean) {
    await page.evaluate((c) => {
        const w = window as any
        w.__ev = []
        w.__reached = false
        w.__consume = c
    }, consume)
}

const readState = (page: Page) =>
    page.evaluate(() => {
        const w = window as any
        return {ev: w.__ev as any[], reached: w.__reached as boolean}
    })

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await waitForGrid(page)
    await installCraftHandler(page)
})

test('active craft receives canvas events with resolved cell coordinates', async ({
    page,
}) => {
    await reset(page, true)
    await canvas(page).click({position: {x: 140, y: 90}})

    const {ev} = await readState(page)
    const down = ev.find((e) => e.type === 'mousedown')
    expect(down, 'craft should receive a mousedown').toBeTruthy()
    // Cell resolution happens synchronously on the main thread.
    expect(typeof down.row).toBe('number')
    expect(typeof down.col).toBe('number')
    expect(down.row).toBeGreaterThanOrEqual(0)
    expect(down.col).toBeGreaterThanOrEqual(0)
    expect(down.sheetIdx).toBe(0)
})

test('a consuming craft blocks the event from reaching the engine', async ({
    page,
}) => {
    await reset(page, true) // consume
    await canvas(page).click({position: {x: 140, y: 90}})

    const {ev, reached} = await readState(page)
    expect(ev.some((e) => e.type === 'mousedown')).toBe(true)
    expect(reached, 'engine canvas must NOT receive a consumed event').toBe(false)
})

test('a passing craft lets the event through to the engine', async ({page}) => {
    await reset(page, false) // pass through
    await canvas(page).click({position: {x: 140, y: 90}})

    const {ev, reached} = await readState(page)
    expect(ev.some((e) => e.type === 'mousedown')).toBe(true)
    expect(reached, 'engine canvas SHOULD receive a passed-through event').toBe(
        true
    )
})

test('keyboard events route through the craft too', async ({page}) => {
    // Consume the mousedown; our interceptor focuses the canvas so keydowns
    // still flow here.
    await reset(page, true)
    await canvas(page).click({position: {x: 140, y: 90}})

    await reset(page, true) // clear the click events, keep consuming
    await page.keyboard.press('a')

    const {ev, reached} = await readState(page)
    const key = ev.find((e) => e.type === 'keydown')
    expect(key, 'craft should receive a keydown').toBeTruthy()
    expect(key.key).toBe('a')
    expect(reached, 'engine must NOT receive a consumed keydown').toBe(false)
})

test('closing the panel deactivates routing — events go straight to the engine', async ({
    page,
}) => {
    await page.getByRole('button', {name: 'Close craft panel'}).click()

    await reset(page, true) // handler still registered, but craft is inactive
    await canvas(page).click({position: {x: 140, y: 90}})

    const {ev, reached} = await readState(page)
    expect(ev.length, 'inactive craft handler must not be called').toBe(0)
    expect(reached, 'engine should receive the event when no craft is active').toBe(
        true
    )
})
