import {test, expect, type Page} from '@playwright/test'

/**
 * End-to-end coverage for the engine's built-in canvas zoom
 * (packages/engine — Engine.setZoom + the wheel/shortcut handling in
 * Spreadsheet.svelte).
 *
 * Zoom rides the workbook-unit ↔ pixel converters, so it shows up as every
 * cell (and therefore every column header) getting wider — which is what these
 * tests measure. The header DOM is the cheapest observable: the canvas itself
 * is painted in a worker.
 */

/**
 * The engine's primary modifier is ⌘ on Apple platforms, Ctrl elsewhere, and it
 * decides that in the page (see `isApplePlatform`). Playwright's Chromium
 * reports `userAgentData.platform === 'Windows'` even on macOS, so mirror the
 * same check rather than guessing from the host OS.
 */
async function primaryModifier(page: Page): Promise<'Meta' | 'Control'> {
    const isApple = await page.evaluate(() => {
        const p =
            (navigator as {userAgentData?: {platform?: string}}).userAgentData
                ?.platform ??
            navigator.platform ??
            ''
        return /mac|iphone|ipad|ipod/i.test(p)
    })
    return isApple ? 'Meta' : 'Control'
}

const gridCanvas = (page: Page) => page.locator('canvas.main-canvas').first()

/** Width of the first column header, in CSS px — our stand-in for the zoom. */
async function colWidth(page: Page): Promise<number> {
    const box = await page.locator('.column-header').first().boundingBox()
    return box?.width ?? 0
}

/** Ctrl/⌘ + wheel over the grid. `up` zooms in, otherwise out. */
async function wheelZoom(page: Page, up: boolean, steps = 1) {
    await gridCanvas(page).hover({position: {x: 300, y: 200}})
    // A real Ctrl+wheel — the same event a trackpad pinch produces.
    await page.keyboard.down('Control')
    for (let i = 0; i < steps; i += 1) {
        await page.mouse.wheel(0, up ? -100 : 100)
        await page.waitForTimeout(150)
    }
    await page.keyboard.up('Control')
}

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await expect(page.locator('canvas').first()).toBeVisible({timeout: 30_000})
    await expect(page.locator('.column-header').first()).toBeVisible({
        timeout: 30_000,
    })
})

test('Ctrl + wheel zooms the canvas in and out', async ({page}) => {
    const base = await colWidth(page)
    expect(base).toBeGreaterThan(0)

    await wheelZoom(page, true, 2)
    const zoomedIn = await colWidth(page)
    expect(zoomedIn).toBeGreaterThan(base * 1.1)

    await wheelZoom(page, false, 4)
    const zoomedOut = await colWidth(page)
    expect(zoomedOut).toBeLessThan(base * 0.95)
})

test('zoom stays within the configured limits', async ({page}) => {
    const base = await colWidth(page)

    // maxZoom is 3 — far fewer notches than this would reach it.
    await wheelZoom(page, true, 20)
    expect(await colWidth(page)).toBeLessThanOrEqual(base * 3 + 1)

    // ...and minZoom is 0.5.
    await wheelZoom(page, false, 40)
    expect(await colWidth(page)).toBeGreaterThanOrEqual(base * 0.5 - 1)
})

test('Ctrl/⌘ +, - and 0 zoom in, out and back to 100%', async ({page}) => {
    const primary = await primaryModifier(page)
    const base = await colWidth(page)

    // Focus the grid so the chords reach the engine's keydown handler.
    await gridCanvas(page).click({position: {x: 150, y: 120}})

    await page.keyboard.press(`${primary}+Equal`)
    await expect
        .poll(() => colWidth(page), {timeout: 5_000})
        .toBeGreaterThan(base)

    await page.keyboard.press(`${primary}+Minus`)
    await page.keyboard.press(`${primary}+Minus`)
    await expect.poll(() => colWidth(page), {timeout: 5_000}).toBeLessThan(base)

    await page.keyboard.press(`${primary}+Digit0`)
    await expect
        .poll(() => colWidth(page), {timeout: 5_000})
        .toBeCloseTo(base, 0)
})
