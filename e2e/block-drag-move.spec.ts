import {test, expect, type Page} from '@playwright/test'

/**
 * End-to-end coverage for dragging a block by its border to move it.
 *
 * The engine paints the block's cells on the canvas; the app draws the
 * interactive block overlay (border + widgets) as real DOM
 * (`src/components/block-interface`). Grabbing the block's border and dragging
 * moves the whole block via a `moveBlock` transaction. Dropping onto an area
 * that is occupied — it overlaps another block, or covers a non-empty cell —
 * is refused with a warning toast and the block stays put.
 *
 * These tests drive the real DOM. Cells are located precisely by measuring the
 * row/column header elements, so we can place content in a known cell and drop
 * the block exactly onto it.
 */

const rowHeader = (page: Page, n: number) =>
    page.locator('.row-header').filter({hasText: new RegExp(`^${n}$`)})
const colHeader = (page: Page, name: string) =>
    page.locator('.column-header').filter({hasText: new RegExp(`^${name}$`)})

const blockOutline = (page: Page) => page.getByTestId('block-interface').first()

async function waitForGrid(page: Page) {
    await expect(page.locator('canvas').first()).toBeVisible({timeout: 30_000})
    await expect(rowHeader(page, 1)).toBeVisible({timeout: 30_000})
}

// Viewport-pixel centre of the cell at (column letter, row number). Derived
// from the header strips, so it lands dead-centre on the real cell regardless
// of the engine's row/column sizes.
async function cellCenter(page: Page, col: string, row: number) {
    const ch = await colHeader(page, col).boundingBox()
    const rh = await rowHeader(page, row).boundingBox()
    if (!ch || !rh) throw new Error(`no header box for ${col}${row}`)
    return {x: ch.x + ch.width / 2, y: rh.y + rh.height / 2}
}

// Select a single cell and turn it into a form block via the composer.
async function createBlockAt(page: Page, col: string, row: number) {
    const start = await cellCenter(page, col, row)
    // A tiny drag makes a one-cell range selection (enables CreateBlock).
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 3, start.y + 3, {steps: 3})
    await page.mouse.up()

    const create = page.getByRole('button', {name: /CreateBlock/i})
    await expect(create).toBeEnabled()
    await create.click()

    await page.getByPlaceholder(/customers/i).fill('drag-test')
    await page.getByRole('button', {name: /save changes/i}).click()

    await expect(blockOutline(page)).toBeVisible({timeout: 15_000})
}

// Type a value into a cell and commit it.
async function typeIntoCell(page: Page, col: string, row: number, text: string) {
    const c = await cellCenter(page, col, row)
    await page.mouse.click(c.x, c.y)
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
    // Let the transaction round-trip through the worker before we read it back.
    await page.waitForTimeout(300)
}

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await waitForGrid(page)
})

test('dragging a block border moves it to an empty area', async ({page}) => {
    await createBlockAt(page, 'B', 3)

    const outline = blockOutline(page)
    expect(await outline.getAttribute('data-col-start')).toBe('1') // column B

    // Grab the LEFT border (just outside the outline → cell A3) and drag right
    // to column F. Delta is (F - A) = 5 columns, so the master lands on
    // column G (index 6); the row is unchanged.
    const b = await outline.boundingBox()
    if (!b) throw new Error('no outline box')
    const target = await cellCenter(page, 'F', 3)
    await page.mouse.move(b.x - 3, b.y + b.height / 2)
    await page.mouse.down()
    await page.mouse.move(target.x, target.y, {steps: 12})
    await page.mouse.up()

    // The block moved: its master column changed, and no warning appeared.
    await expect(outline).toHaveAttribute('data-col-start', '6', {
        timeout: 10_000,
    })
    await expect(
        page.getByText('Cannot move block: the target area is occupied')
    ).toHaveCount(0)
})

test('dropping a block onto a non-empty cell is refused with a toast', async ({
    page,
}) => {
    await createBlockAt(page, 'B', 3)
    const outline = blockOutline(page)

    // Put a value in B6 — directly below the block, same column.
    await typeIntoCell(page, 'B', 6, 'hello')

    // Grab the TOP border (just above the outline → cell B2) and drag straight
    // down onto B5. Delta is (row5 - row2) = 3 rows, so the master lands on
    // B6 — the cell we just filled — which must refuse the move.
    const b = await outline.boundingBox()
    if (!b) throw new Error('no outline box')
    const target = await cellCenter(page, 'B', 5)
    await page.mouse.move(b.x + b.width / 2, b.y - 3)
    await page.mouse.down()
    await page.mouse.move(target.x, target.y, {steps: 12})
    await page.mouse.up()

    // A warning toast appears and the block did not move.
    await expect(
        page.getByText('Cannot move block: the target area is occupied')
    ).toBeVisible({timeout: 10_000})
    await expect(outline).toHaveAttribute('data-row-start', '2') // still row 3
    await expect(outline).toHaveAttribute('data-col-start', '1')
})

test('dropping a block onto another block is refused with a toast', async ({
    page,
}) => {
    // Block A at B3, block B at F3 — both one-cell form blocks.
    await createBlockAt(page, 'B', 3)
    await createBlockAt(page, 'F', 3)

    // Block A is the one whose master is column B (index 1). Its cells are
    // empty, so this is purely a block-overlap refusal.
    const blockA = page
        .locator('[data-testid="block-interface"][data-col-start="1"]')
        .first()
    await expect(blockA).toBeVisible()

    // Grab A's LEFT border (→ cell A3) and drag right onto E3: delta (E - A) =
    // 4 columns lands A's master on F3, exactly over block B.
    const b = await blockA.boundingBox()
    if (!b) throw new Error('no outline box')
    const target = await cellCenter(page, 'E', 3)
    await page.mouse.move(b.x - 3, b.y + b.height / 2)
    await page.mouse.down()
    await page.mouse.move(target.x, target.y, {steps: 12})
    await page.mouse.up()

    await expect(
        page.getByText('Cannot move block: the target area is occupied')
    ).toBeVisible({timeout: 10_000})
    // Block A stayed at column B (still exactly one block on column B).
    await expect(
        page.locator('[data-testid="block-interface"][data-col-start="1"]')
    ).toHaveCount(1)
})
