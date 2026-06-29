import {test, expect, type Page} from '@playwright/test'

/**
 * End-to-end coverage for the canvas right-click menu.
 *
 * The engine itself renders no menu — it emits a `contextMenu` event and the
 * app renders its own (see `src/components/engine-canvas/canvas-context-menu.tsx`).
 * These tests drive the real DOM: the row/column headers and the MUI menu are
 * plain DOM, and inserting a line shifts the selection, which shows up as the
 * `.selected` header moving. That lets us assert real behaviour without
 * reaching into engine internals.
 */

// Row/column headers are <button> elements whose text is the row number /
// column letter. Match the whole (normalized) text so "2" doesn't hit "12".
const rowHeader = (page: Page, n: number) =>
    page.locator('.row-header').filter({hasText: new RegExp(`^${n}$`)})
const colHeader = (page: Page, name: string) =>
    page.locator('.column-header').filter({hasText: new RegExp(`^${name}$`)})

const menu = (page: Page) => page.getByRole('menu')

async function waitForGrid(page: Page) {
    // The grid appears after the worker + WASM boot and the first render.
    await expect(page.locator('canvas').first()).toBeVisible({timeout: 30_000})
    await expect(rowHeader(page, 1)).toBeVisible({timeout: 30_000})
}

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await waitForGrid(page)
})

test('row header menu shows insert/format/delete and a count stepper', async ({
    page,
}) => {
    await rowHeader(page, 2).click({button: 'right'})

    const m = menu(page)
    await expect(
        m.getByRole('menuitem', {name: 'Insert rows above'})
    ).toBeVisible()
    await expect(
        m.getByRole('menuitem', {name: 'Insert rows below'})
    ).toBeVisible()
    await expect(m.getByRole('menuitem', {name: 'Format cells'})).toBeVisible()
    await expect(m.getByRole('menuitem', {name: 'Delete rows'})).toBeVisible()
    // Count stepper defaults to the number of selected lines (1 here).
    await expect(m.locator('input[type=number]')).toHaveValue('1')
})

test('column header menu shows column insert/delete actions', async ({
    page,
}) => {
    await colHeader(page, 'B').click({button: 'right'})

    const m = menu(page)
    await expect(
        m.getByRole('menuitem', {name: 'Insert columns left'})
    ).toBeVisible()
    await expect(
        m.getByRole('menuitem', {name: 'Insert columns right'})
    ).toBeVisible()
    await expect(
        m.getByRole('menuitem', {name: 'Delete columns'})
    ).toBeVisible()
})

test('cell menu shows Format / Clear', async ({page}) => {
    await page
        .locator('canvas')
        .first()
        .click({
            button: 'right',
            position: {x: 120, y: 80},
        })

    const m = menu(page)
    await expect(m.getByRole('menuitem', {name: 'Format Cells'})).toBeVisible()
    await expect(m.getByRole('menuitem', {name: 'Clear Cells'})).toBeVisible()
})

test('the stepper adjusts the count without closing the menu', async ({
    page,
}) => {
    await rowHeader(page, 2).click({button: 'right'})
    const stepper = menu(page).locator('input[type=number]')
    await expect(stepper).toHaveValue('1')

    // Decrement is clamped at the minimum of 1, and the menu stays open.
    await menu(page).getByRole('button', {name: 'decrease'}).click()
    await expect(stepper).toHaveValue('1')

    await menu(page).getByRole('button', {name: 'increase'}).click()
    await menu(page).getByRole('button', {name: 'increase'}).click()
    await expect(stepper).toHaveValue('3')
    // Menu is still open after adjusting.
    await expect(menu(page)).toBeVisible()
})

test('inserting N rows above shifts the selection down by N', async ({
    page,
}) => {
    // Right-click row 3 (index 2) — this selects it and opens the menu.
    await rowHeader(page, 3).click({button: 'right'})
    await expect(page.locator('.row-header.selected')).toHaveText('3')

    // Dial the count up to 3, then insert above.
    await menu(page).getByRole('button', {name: 'increase'}).click()
    await menu(page).getByRole('button', {name: 'increase'}).click()
    await expect(menu(page).locator('input[type=number]')).toHaveValue('3')
    await menu(page).getByRole('menuitem', {name: 'Insert rows above'}).click()

    // Row 3 (idx 2) + 3 inserted rows -> the original selection now sits at
    // idx 5, i.e. the header labelled "6".
    await expect(page.locator('.row-header.selected')).toHaveCount(1)
    await expect(page.locator('.row-header.selected')).toHaveText('6')
})

test('inserting a column left shifts the column selection right', async ({
    page,
}) => {
    // Right-click column B (index 1) — selects it and opens the menu.
    await colHeader(page, 'B').click({button: 'right'})
    await expect(page.locator('.column-header.selected')).toHaveText('B')

    await menu(page)
        .getByRole('menuitem', {name: 'Insert columns left'})
        .click()

    // One column inserted at B -> the original selection moves to C.
    await expect(page.locator('.column-header.selected')).toHaveCount(1)
    await expect(page.locator('.column-header.selected')).toHaveText('C')
})
