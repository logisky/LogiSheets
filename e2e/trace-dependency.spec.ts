import {test, expect, type Page} from '@playwright/test'

/**
 * End-to-end coverage for formula auditing — the "Trace precedents / dependents"
 * right-click actions (`trace-layer.tsx` + `canvas-context-menu.tsx`). This
 * drives the whole live chain: app → worker → wasm `get_precedents` /
 * `get_dependents` → the highlight overlay.
 *
 * The grid is a canvas. We type formulas with explicit A1 references (so we
 * don't need to know which cell a pixel maps to), then trace the cell we typed
 * into. The highlight boxes carry stable testids (`trace-origin`, one
 * `trace-highlight` per traced cell/range).
 */

const gridCanvas = (page: Page) => page.locator('canvas').first()
const menu = (page: Page) => page.getByRole('menu')
const origin = (page: Page) => page.getByTestId('trace-origin')
const highlights = (page: Page) => page.getByTestId('trace-highlight')

// A cell well away from the top-left, so A1/A2 are distinct visible cells.
const FORMULA_CELL = {x: 320, y: 200}

async function waitForGrid(page: Page) {
    await expect(page.locator('canvas').first()).toBeVisible({timeout: 30_000})
    await expect(
        page.locator('.row-header').filter({hasText: /^1$/})
    ).toBeVisible({timeout: 30_000})
}

async function typeInCell(page: Page, pos: {x: number; y: number}, text: string) {
    await gridCanvas(page).click({position: pos})
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
}

test.beforeEach(async ({page}) => {
    // Surface runtime errors so a failure explains itself.
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
    page.on('console', (m) => {
        if (m.type() === 'error') console.log('CONSOLE.error:', m.text())
    })
    await page.goto('/')
    await waitForGrid(page)
})

test('the cell menu offers Trace precedents / dependents', async ({page}) => {
    await gridCanvas(page).click({button: 'right', position: FORMULA_CELL})
    await expect(
        menu(page).getByRole('menuitem', {name: 'Trace precedents'})
    ).toBeVisible()
    await expect(
        menu(page).getByRole('menuitem', {name: 'Trace dependents'})
    ).toBeVisible()
})

test('Trace precedents highlights the cells the formula references', async ({
    page,
}) => {
    // A formula referencing A1 and A2 (both visible, top-left).
    await typeInCell(page, FORMULA_CELL, '=A1+A2')

    await gridCanvas(page).click({button: 'right', position: FORMULA_CELL})
    await menu(page).getByRole('menuitem', {name: 'Trace precedents'}).click()

    // Origin (the formula cell) + at least one referenced cell highlighted.
    await expect(origin(page)).toBeVisible()
    await expect(highlights(page).first()).toBeVisible()
    expect(await highlights(page).count()).toBeGreaterThanOrEqual(1)
})

test('Trace dependents on a formula-less cell still highlights the origin', async ({
    page,
}) => {
    // A plain value has no dependents; the trace still runs end-to-end and the
    // origin highlight proves the whole app→worker→wasm→overlay chain worked.
    await typeInCell(page, FORMULA_CELL, '9')

    await gridCanvas(page).click({button: 'right', position: FORMULA_CELL})
    await menu(page).getByRole('menuitem', {name: 'Trace dependents'}).click()

    await expect(origin(page)).toBeVisible()
})

test('Clear trace removes the highlights', async ({page}) => {
    await typeInCell(page, FORMULA_CELL, '=A1+A2')
    await gridCanvas(page).click({button: 'right', position: FORMULA_CELL})
    await menu(page).getByRole('menuitem', {name: 'Trace precedents'}).click()
    await expect(origin(page)).toBeVisible()

    // "Clear trace" appears only while a trace is active.
    await gridCanvas(page).click({button: 'right', position: FORMULA_CELL})
    await menu(page).getByRole('menuitem', {name: 'Clear trace'}).click()
    await expect(origin(page)).toHaveCount(0)
    await expect(highlights(page)).toHaveCount(0)
})

test('Esc clears the trace', async ({page}) => {
    await typeInCell(page, FORMULA_CELL, '=A1+A2')
    await gridCanvas(page).click({button: 'right', position: FORMULA_CELL})
    await menu(page).getByRole('menuitem', {name: 'Trace precedents'}).click()
    await expect(origin(page)).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(origin(page)).toHaveCount(0)
})
