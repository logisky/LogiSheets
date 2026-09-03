import {test, expect, type Page} from '@playwright/test'
import {createBlockButton} from './toolbar'

/**
 * End-to-end coverage for sorting a block's records by one of its fields.
 *
 * The engine paints block cells on the canvas; the app draws the interactive
 * block overlay (border, field-name headers, add-row button) as real DOM
 * (`src/components/block-interface`). Clicking a field-name header opens a
 * small menu ("Sort ascending" / "Sort descending"); choosing a direction runs
 * `ops.sortBlock`, which asks the Rust engine for the type-aware order
 * (`getBlockSortOrder`) and commits it as a `reorderBlockLines` transaction.
 *
 * The grid itself is a canvas, so a cell's value is read back by opening the
 * in-cell editor on it (double-click) and reading the editor's text. That lets
 * the data-verification test confirm the records actually reordered.
 *
 * Field-name headers only appear while the block is hovered (`showInfo`), so
 * every interaction hovers the block first.
 */

const rowHeader = (page: Page, n: number) =>
    page.locator('.row-header').filter({hasText: new RegExp(`^${n}$`)})
const colHeader = (page: Page, name: string) =>
    page.locator('.column-header').filter({hasText: new RegExp(`^${name}$`)})

const blockOutline = (page: Page) => page.getByTestId('block-interface').first()
const inCellEditor = (page: Page) =>
    page.locator('.logisheets-inline-cell-editor')

async function waitForGrid(page: Page) {
    await expect(page.locator('canvas').first()).toBeVisible({timeout: 30_000})
    await expect(rowHeader(page, 1)).toBeVisible({timeout: 30_000})
}

// Viewport-pixel centre of the cell at (column letter, row number), derived
// from the header strips so it lands dead-centre regardless of cell sizes.
async function cellCenter(page: Page, col: string, row: number) {
    const ch = await colHeader(page, col).boundingBox()
    const rh = await rowHeader(page, row).boundingBox()
    if (!ch || !rh) throw new Error(`no header box for ${col}${row}`)
    return {x: ch.x + ch.width / 2, y: rh.y + rh.height / 2}
}

// Select a single cell and turn it into a form block via the composer. The
// default composer schema is one string field named "Customer Status".
async function createBlockAt(page: Page, col: string, row: number) {
    const start = await cellCenter(page, col, row)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 3, start.y + 3, {steps: 3})
    await page.mouse.up()

    const create = await createBlockButton(page)
    await expect(create).toBeEnabled()
    await create.click()

    await page.getByPlaceholder(/customers/i).fill('sort-test')
    await page.getByRole('button', {name: /save changes/i}).click()

    await expect(blockOutline(page)).toBeVisible({timeout: 15_000})
}

// Hover the block centre so the DOM overlay (field headers, add-row) renders.
async function hoverBlock(page: Page) {
    const b = await blockOutline(page).boundingBox()
    if (!b) throw new Error('no block outline box')
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
}

// Type a value into a cell and commit it.
async function typeIntoCell(
    page: Page,
    col: string,
    row: number,
    text: string
) {
    const c = await cellCenter(page, col, row)
    await page.mouse.click(c.x, c.y)
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
    // Let the transaction round-trip through the worker before the next step.
    await page.waitForTimeout(300)
}

// Read a cell's committed value by opening the in-cell editor on it, reading the
// editor text, then cancelling (Escape) so nothing is mutated.
async function readCell(page: Page, col: string, row: number): Promise<string> {
    const c = await cellCenter(page, col, row)
    await page.mouse.dblclick(c.x, c.y)
    const editor = inCellEditor(page)
    await expect(editor).toBeVisible()
    const text = ((await editor.textContent()) ?? '').trim()
    await page.keyboard.press('Escape')
    await expect(editor).toBeHidden()
    return text
}

// The field-name header for `name` inside the (hovered) block overlay.
const fieldHeader = (page: Page, name: string) =>
    page.getByTestId('block-interface').getByText(name, {exact: true})

async function openSortMenu(page: Page, field: string) {
    await hoverBlock(page)
    const header = fieldHeader(page, field)
    await expect(header).toBeVisible({timeout: 10_000})
    await header.click()
}

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await waitForGrid(page)
})

test('clicking a field header opens the sort menu and sorting completes without error', async ({
    page,
}) => {
    await createBlockAt(page, 'B', 3)

    await openSortMenu(page, 'Customer Status')

    // Both directions are offered.
    const asc = page.getByRole('menuitem', {name: /sort ascending/i})
    const desc = page.getByRole('menuitem', {name: /sort descending/i})
    await expect(asc).toBeVisible()
    await expect(desc).toBeVisible()

    // Choosing a direction runs the sort end-to-end (React → ops.sortBlock →
    // engine getBlockSortOrder → reorderBlockLines). The menu closes and no
    // error toast appears.
    await asc.click()
    await expect(asc).toHaveCount(0)
    await expect(page.getByText(/Failed to sort/i)).toHaveCount(0)
    await expect(blockOutline(page)).toBeVisible()

    // Descending works too.
    await openSortMenu(page, 'Customer Status')
    await page.getByRole('menuitem', {name: /sort descending/i}).click()
    await expect(
        page.getByRole('menuitem', {name: /sort descending/i})
    ).toHaveCount(0)
    await expect(page.getByText(/Failed to sort/i)).toHaveCount(0)
})

test('sorting reorders the records ascending and descending', async ({
    page,
}) => {
    await createBlockAt(page, 'B', 3)

    // Grow the block to three records (default is one), then fill the field
    // column with deliberately out-of-order text values in B3:B5.
    const addRow = page.getByRole('button', {name: /add new row/i})
    await hoverBlock(page)
    await expect(addRow).toBeVisible({timeout: 10_000})
    await addRow.click()
    await hoverBlock(page)
    await addRow.click()

    await typeIntoCell(page, 'B', 3, 'Charlie')
    await typeIntoCell(page, 'B', 4, 'Alice')
    await typeIntoCell(page, 'B', 5, 'Bob')

    // Sanity: the three records are populated as typed BEFORE any sort.
    expect([
        await readCell(page, 'B', 3),
        await readCell(page, 'B', 4),
        await readCell(page, 'B', 5),
    ]).toEqual(['Charlie', 'Alice', 'Bob'])

    // Ascending → Alice, Bob, Charlie top-to-bottom.
    await openSortMenu(page, 'Customer Status')
    await page.getByRole('menuitem', {name: /sort ascending/i}).click()
    await expect(page.getByText(/Failed to sort/i)).toHaveCount(0)
    await page.waitForTimeout(400)
    expect(await readCell(page, 'B', 3)).toBe('Alice')
    expect(await readCell(page, 'B', 5)).toBe('Charlie')

    // Descending → Charlie, Bob, Alice.
    await openSortMenu(page, 'Customer Status')
    await page.getByRole('menuitem', {name: /sort descending/i}).click()
    await expect(page.getByText(/Failed to sort/i)).toHaveCount(0)
    await page.waitForTimeout(400)
    expect(await readCell(page, 'B', 3)).toBe('Charlie')
    expect(await readCell(page, 'B', 5)).toBe('Alice')
})
