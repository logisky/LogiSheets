import {test, expect, type Page} from '@playwright/test'

/**
 * End-to-end coverage for "Convert to block…" — the LogiSheets analogue of
 * Excel's Ctrl+T, exposed on the cell right-click menu.
 *
 * Right-clicking a selected region offers "Convert to block…", which reads the
 * region, infers a schema (field names from a header row, column types from the
 * data — see src/components/block-composer/infer) and opens the block composer
 * in *convert* mode pre-filled. Saving turns the region (minus the header row)
 * into a form block in place.
 *
 * The grid is a canvas, so cells are addressed by measuring the row/column
 * header strips; the menu and composer are real DOM.
 */

const rowHeader = (page: Page, n: number) =>
    page.locator('.row-header').filter({hasText: new RegExp(`^${n}$`)})
const colHeader = (page: Page, name: string) =>
    page.locator('.column-header').filter({hasText: new RegExp(`^${name}$`)})

async function waitForGrid(page: Page) {
    await expect(page.locator('canvas').first()).toBeVisible({timeout: 30_000})
    await expect(rowHeader(page, 1)).toBeVisible({timeout: 30_000})
}

// Viewport-pixel centre of the cell at (column letter, row number).
async function cellCenter(page: Page, col: string, row: number) {
    const ch = await colHeader(page, col).boundingBox()
    const rh = await rowHeader(page, row).boundingBox()
    if (!ch || !rh) throw new Error(`no header box for ${col}${row}`)
    return {x: ch.x + ch.width / 2, y: rh.y + rh.height / 2}
}

// Type a value into a cell and commit it.
async function typeIntoCell(page: Page, col: string, row: number, text: string) {
    const c = await cellCenter(page, col, row)
    await page.mouse.click(c.x, c.y)
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
    // Let the transaction round-trip through the worker before the next step.
    await page.waitForTimeout(250)
}

// Drag-select the rectangular range from (c1,r1) to (c2,r2).
async function selectRange(
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
    await page.waitForTimeout(150)
}

// Right-click a cell (must be inside the current selection so the engine keeps
// the range) to open the canvas context menu.
async function rightClickCell(page: Page, col: string, row: number) {
    const c = await cellCenter(page, col, row)
    await page.mouse.click(c.x, c.y, {button: 'right'})
}

// Type a 2-column header (Name, Age) + two data rows into B2:C4, then select the
// whole region and open the context menu inside it.
async function seedTableAndOpenMenu(page: Page) {
    await typeIntoCell(page, 'B', 2, 'Name')
    await typeIntoCell(page, 'C', 2, 'Age')
    await typeIntoCell(page, 'B', 3, 'Alice')
    await typeIntoCell(page, 'C', 3, '30')
    await typeIntoCell(page, 'B', 4, 'Bob')
    await typeIntoCell(page, 'C', 4, '25')

    await selectRange(page, 'B', 2, 'C', 4)
    // Right-click a cell inside the selection so the range is preserved.
    await rightClickCell(page, 'C', 3)
}

const dialog = (page: Page) => page.getByRole('dialog')

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await waitForGrid(page)
})

test('right-click offers "Convert to block…" and pre-fills the composer from the header row', async ({
    page,
}) => {
    await seedTableAndOpenMenu(page)

    const convert = page.getByRole('menuitem', {name: /convert to block/i})
    await expect(convert).toBeVisible({timeout: 10_000})
    await convert.click()

    // The composer opens in convert mode, pre-filled from the inferred schema.
    // Each field-list entry is a button whose accessible name encodes the
    // field's name + flags + type, so these locators assert BOTH the header-row
    // names (Name, Age) AND the inferred types (text→String, numbers→Number) at
    // once — not the generic "Field 1/2" fallback.
    const d = dialog(page)
    await expect(d).toBeVisible({timeout: 10_000})
    await expect(
        d.getByRole('button', {name: /Name.*Primary.*String/i})
    ).toBeVisible()
    await expect(d.getByRole('button', {name: /Age.*Number/i})).toBeVisible()
    await expect(d.getByRole('button', {name: /Field \d/i})).toHaveCount(0)
})

test('saving a converted block creates it over the data rows', async ({
    page,
}) => {
    await seedTableAndOpenMenu(page)
    await page.getByRole('menuitem', {name: /convert to block/i}).click()

    const d = dialog(page)
    await expect(d).toBeVisible({timeout: 10_000})

    // Name the block and save. Convert mode requires exactly one field per
    // column (2 here), which the inference already produced.
    await d.getByPlaceholder(/customers/i).fill('people')
    await d.getByRole('button', {name: /save changes/i}).click()

    // The convert transaction ran end-to-end. The composer's `handleSave` awaits
    // `ops.convertToFormBlock` and only shows this success toast (and closes) if
    // the transaction resolved without error — if the engine had rejected it,
    // an error toast would show and the dialog would stay open. So this single
    // assertion proves the whole path: menu → infer → composer → convert.
    await expect(page.getByText(/configured successfully/i)).toBeVisible({
        timeout: 15_000,
    })
    await expect(d).toBeHidden({timeout: 15_000})
    await expect(page.getByText(/failed/i)).toHaveCount(0)

    // The region is now a block, and its interactive overlay renders as DOM.
    // (This is what regressed when the convert transaction reported DoNothing —
    // the trailing render-info payload overwrote the cell-updated flag, so the
    // host never re-rendered. Fixed by accumulating the flag across payloads.)
    await expect(page.getByTestId('block-interface').first()).toBeVisible({
        timeout: 15_000,
    })
})
