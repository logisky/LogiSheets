import {test, expect, type Page} from '@playwright/test'

/**
 * End-to-end coverage for reordering a block's fields by dragging a field-name
 * header to a new position.
 *
 * The app draws the block overlay (border, field headers) as real DOM
 * (`src/components/block-interface`). A field header is draggable: grabbing it
 * and dropping past another header dispatches `ops.moveBlockLine` (isRow:false),
 * which reorders the block's columns in the engine; the overlay then re-renders
 * with the fields in their new order. A plain click (no drag) still opens the
 * sort menu.
 *
 * Field headers only appear while the block is hovered (`showInfo`), so every
 * interaction hovers the block first.
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

async function cellCenter(page: Page, col: string, row: number) {
    const ch = await colHeader(page, col).boundingBox()
    const rh = await rowHeader(page, row).boundingBox()
    if (!ch || !rh) throw new Error(`no header box for ${col}${row}`)
    return {x: ch.x + ch.width / 2, y: rh.y + rh.height / 2}
}

// Create a two-field block at B3 via the toolbar composer: the default schema
// has one string field ("Customer Status"); "Add New Field" appends a second
// ("New Field"). Saving builds a 1-row, 2-column form block.
async function createTwoFieldBlock(page: Page) {
    const start = await cellCenter(page, 'B', 3)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 3, start.y + 3, {steps: 3})
    await page.mouse.up()

    const create = page.getByRole('button', {name: /CreateBlock/i})
    await expect(create).toBeEnabled()
    await create.click()

    const d = page.getByRole('dialog')
    await expect(d).toBeVisible({timeout: 10_000})
    await d.getByRole('button', {name: /add new field/i}).click()
    await d.getByPlaceholder(/customers/i).fill('drag-test')
    await d.getByRole('button', {name: /save changes/i}).click()

    await expect(blockOutline(page)).toBeVisible({timeout: 15_000})
}

async function hoverBlock(page: Page) {
    const b = await blockOutline(page).boundingBox()
    if (!b) throw new Error('no block outline box')
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
}

const fieldHeader = (page: Page, name: string) =>
    page.getByTestId('block-interface').getByText(name, {exact: true})

async function headerBox(page: Page, name: string) {
    await hoverBlock(page)
    const h = fieldHeader(page, name)
    await expect(h).toBeVisible({timeout: 10_000})
    const b = await h.boundingBox()
    if (!b) throw new Error(`no header box for ${name}`)
    return b
}

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await waitForGrid(page)
})

test('dragging a field header past another reorders the fields', async ({
    page,
}) => {
    await createTwoFieldBlock(page)

    // Initial order: "Customer Status" is left of "New Field".
    const first = await headerBox(page, 'Customer Status')
    const second = await headerBox(page, 'New Field')
    expect(first.x).toBeLessThan(second.x)

    // Drag "Customer Status" across "New Field" and drop on its right half.
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2)
    await page.mouse.down()
    await page.mouse.move(
        second.x + second.width * 0.75,
        second.y + second.height / 2,
        {steps: 12}
    )
    await page.mouse.up()
    await page.waitForTimeout(500)

    // Order swapped: "New Field" is now left of "Customer Status", and no error.
    await expect(page.getByText(/Failed to move field/i)).toHaveCount(0)
    const newFirst = await headerBox(page, 'New Field')
    const newSecond = await headerBox(page, 'Customer Status')
    expect(newFirst.x).toBeLessThan(newSecond.x)
})

test('a plain click on a field header still opens the sort menu (not a drag)', async ({
    page,
}) => {
    await createTwoFieldBlock(page)

    await hoverBlock(page)
    const header = fieldHeader(page, 'Customer Status')
    await expect(header).toBeVisible({timeout: 10_000})
    await header.click()

    // The click was not swallowed by the drag handler — the sort menu opened.
    await expect(
        page.getByRole('menuitem', {name: /sort ascending/i})
    ).toBeVisible({timeout: 10_000})
    await expect(page.getByText(/Failed to move field/i)).toHaveCount(0)
})
