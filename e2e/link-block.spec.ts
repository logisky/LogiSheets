import {test, expect, type Page} from '@playwright/test'

/**
 * End-to-end coverage for the "link a range to a block" right-click action
 * (`canvas-context-menu.tsx` → `getLinkableBlocks` → CreateLink/ConvertBlock).
 *
 * The canvas region-select + pick gesture isn't scriptable here, so this asserts
 * the two things that ARE observable and prove the wiring:
 *   1. the cell menu offers "Link to block…";
 *   2. clicking it opens the picker with "Create a new block…", which only
 *      appears if `getLinkableBlocks` (app → worker → wasm) resolved without
 *      error — i.e. the whole new RPC chain is live.
 */

const gridCanvas = (page: Page) => page.locator('canvas').first()
const menu = (page: Page) => page.getByRole('menu')
const CELL = {x: 320, y: 200}

async function waitForGrid(page: Page) {
    await expect(page.locator('canvas').first()).toBeVisible({timeout: 30_000})
    await expect(
        page.locator('.row-header').filter({hasText: /^1$/})
    ).toBeVisible({timeout: 30_000})
}

test.beforeEach(async ({page}) => {
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
    page.on('console', (m) => {
        if (m.type() === 'error') console.log('CONSOLE.error:', m.text())
    })
    await page.goto('/')
    await waitForGrid(page)
})

test('the cell menu offers "Link to block…"', async ({page}) => {
    await gridCanvas(page).click({button: 'right', position: CELL})
    await expect(
        menu(page).getByRole('menuitem', {name: /Link to block/})
    ).toBeVisible()
})

test('clicking Link opens the picker (getLinkableBlocks resolves)', async ({
    page,
}) => {
    await gridCanvas(page).click({button: 'right', position: CELL})
    await menu(page).getByRole('menuitem', {name: /Link to block/}).click()
    // The picker always offers "Create a new block…"; its appearance proves the
    // getLinkableBlocks call (app → worker → wasm) came back without erroring.
    await expect(
        page.getByRole('menuitem', {name: /Create a new block/})
    ).toBeVisible()
})

test('Create-a-new-block opens the block-composer (convert mode)', async ({
    page,
}) => {
    await gridCanvas(page).click({button: 'right', position: CELL})
    await menu(page).getByRole('menuitem', {name: /Link to block/}).click()
    await page.getByRole('menuitem', {name: /Create a new block/}).click()
    // "Create new" reuses the existing block-composer in convert mode, so the
    // block gets a ref name + fields at creation (a visible, schema'd block).
    // The composer exposes the ref-name field and its Save action.
    await expect(page.getByText('Block Ref Name')).toBeVisible()
    await expect(
        page.getByRole('button', {name: /Save Changes/})
    ).toBeVisible()
})

test('linking a range to a block draws the outer border', async ({page}) => {
    // Create a 1×1 block at the current selection via the toolbar composer.
    await gridCanvas(page).click({position: {x: 60, y: 30}})
    await page.getByRole('button', {name: 'CreateBlock'}).click()
    await page.getByPlaceholder('e.g. customers').fill('myblock')
    await page.getByRole('button', {name: /Save Changes/}).click()
    await expect(page.getByText(/configured successfully/i)).toBeVisible()

    // Link a *different* single cell (matching column count) to that block.
    await gridCanvas(page).click({button: 'right', position: CELL})
    await menu(page).getByRole('menuitem', {name: /Link to block/}).click()
    await page
        .getByRole('menuitem', {name: /Block #\d+ · .* myblock/})
        .click()

    // The linked source range now carries the dashed outer border.
    await expect(page.locator('[data-testid="link-border"]')).toHaveCount(1)
    await expect(
        page.locator('[data-testid="link-border"]')
    ).toBeVisible()
})
