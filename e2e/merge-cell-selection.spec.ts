import {test, expect, type Page} from '@playwright/test'

/**
 * End-to-end coverage for selecting a merged cell.
 *
 * Regression test for a bug where clicking a merged cell selected only its
 * top-left anchor instead of the whole merge: the engine's `match()` already
 * expands a click inside a merge to the full span, but the click handlers in
 * `packages/engine/.../Spreadsheet.svelte` collapsed it back to a 1x1 range
 * before building the selection.
 *
 * The selection border is painted on the canvas, so we can't read it directly.
 * Instead we assert on the row/column header strips, which are real DOM: every
 * header inside the selected cell range gets `.selected`. A whole-merge
 * selection therefore lights up B+C (columns) and 2+3 (rows); the old buggy
 * behaviour lit up only B and 2.
 */

const rowHeader = (page: Page, n: number) =>
    page.locator('.row-header').filter({hasText: new RegExp(`^${n}$`)})
const colHeader = (page: Page, name: string) =>
    page.locator('.column-header').filter({hasText: new RegExp(`^${name}$`)})

const selectedCols = (page: Page) => page.locator('.column-header.selected')
const selectedRows = (page: Page) => page.locator('.row-header.selected')

async function waitForGrid(page: Page) {
    await expect(page.locator('canvas').first()).toBeVisible({timeout: 30_000})
    await expect(rowHeader(page, 1)).toBeVisible({timeout: 30_000})
}

// Viewport-pixel centre of the cell at (column letter, row number), derived
// from the header strips so it lands dead-centre regardless of row/column
// sizes.
async function cellCenter(page: Page, col: string, row: number) {
    const ch = await colHeader(page, col).boundingBox()
    const rh = await rowHeader(page, row).boundingBox()
    if (!ch || !rh) throw new Error(`no header box for ${col}${row}`)
    return {x: ch.x + ch.width / 2, y: rh.y + rh.height / 2}
}

async function clickCell(page: Page, col: string, row: number) {
    const c = await cellCenter(page, col, row)
    await page.mouse.click(c.x, c.y)
}

// Drag-select the rectangle from (c1,r1) to (c2,r2).
async function dragSelect(
    page: Page,
    c1: string,
    r1: number,
    c2: string,
    r2: number
) {
    const a = await cellCenter(page, c1, r1)
    const b = await cellCenter(page, c2, r2)
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(b.x, b.y, {steps: 8})
    await page.mouse.up()
}

// Select B2:C3 and merge it via the toolbar. Leaves the merged cell selected.
async function mergeB2C3(page: Page) {
    await dragSelect(page, 'B', 2, 'C', 3)
    // Sanity: the drag really produced the 2x2 range before we merge.
    await expect(selectedCols(page)).toHaveText(['B', 'C'])
    await expect(selectedRows(page)).toHaveText(['2', '3'])

    const merge = page.getByRole('button', {name: 'Merge'})
    await expect(merge).toBeEnabled()
    await merge.click()
    // Let the merge transaction round-trip through the worker and re-render.
    await page.waitForTimeout(300)
}

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await waitForGrid(page)
})

test('clicking a merged cell by its top-left anchor selects the whole merge', async ({
    page,
}) => {
    await mergeB2C3(page)

    // Move the selection well away from the merge so the next click is what
    // drives the selection (not a leftover range).
    await clickCell(page, 'E', 6)
    await expect(selectedCols(page)).toHaveText(['E'])
    await expect(selectedRows(page)).toHaveText(['6'])

    // Click the merge's top-left anchor cell (B2). The whole merge must select.
    await clickCell(page, 'B', 2)
    await expect(selectedCols(page)).toHaveText(['B', 'C'])
    await expect(selectedRows(page)).toHaveText(['2', '3'])
})

test('clicking an interior cell of the merge also selects the whole merge', async ({
    page,
}) => {
    await mergeB2C3(page)

    await clickCell(page, 'E', 6)
    await expect(selectedCols(page)).toHaveText(['E'])
    await expect(selectedRows(page)).toHaveText(['6'])

    // Click the bottom-right cell of the merge (C3): still the whole merge.
    await clickCell(page, 'C', 3)
    await expect(selectedCols(page)).toHaveText(['B', 'C'])
    await expect(selectedRows(page)).toHaveText(['2', '3'])
})

test('arrow-navigating onto a merged cell selects the whole merge', async ({
    page,
}) => {
    await mergeB2C3(page)

    // Sit just above the merge (B1), then press Down to move onto it.
    await clickCell(page, 'B', 1)
    await expect(selectedCols(page)).toHaveText(['B'])
    await expect(selectedRows(page)).toHaveText(['1'])

    await page.keyboard.press('ArrowDown')
    await expect(selectedCols(page)).toHaveText(['B', 'C'])
    await expect(selectedRows(page)).toHaveText(['2', '3'])
})

test('ArrowRight steps out past the right edge of a merged cell', async ({
    page,
}) => {
    await mergeB2C3(page)

    // Select the whole merge, then ArrowRight must land on D2 (past column C),
    // not C2 which is inside the merge.
    await clickCell(page, 'B', 2)
    await expect(selectedCols(page)).toHaveText(['B', 'C'])
    await page.keyboard.press('ArrowRight')
    await expect(selectedCols(page)).toHaveText(['D'])
    await expect(selectedRows(page)).toHaveText(['2'])
})

test('ArrowDown steps out past the bottom edge of a merged cell', async ({
    page,
}) => {
    await mergeB2C3(page)

    // Select the whole merge, then ArrowDown must land on B4 (past row 3).
    await clickCell(page, 'B', 2)
    await expect(selectedRows(page)).toHaveText(['2', '3'])
    await page.keyboard.press('ArrowDown')
    await expect(selectedCols(page)).toHaveText(['B'])
    await expect(selectedRows(page)).toHaveText(['4'])
})
