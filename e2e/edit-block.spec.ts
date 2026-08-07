import {test, expect, type Page} from '@playwright/test'

/**
 * End-to-end coverage for "Edit block…" — the cell right-click entry that opens
 * the block composer in *edit* mode over an existing form block.
 *
 * Contract: existing fields are editable (name / type / validation / required),
 * each rebuilt preserving its `renderId`; the block ref name is editable too.
 * Fields cannot be DELETED (column count is monotonically non-decreasing).
 * Saving dispatches `ops.editFormBlock` — a tail `resizeBlock` (col count grows)
 * + re-`bindFormSchema` + per-field `upsertFieldRenderInfo`, in one transaction.
 *
 * We first create a block via the already-covered "Convert to block…" flow,
 * then drive the edit flow on top of it. The grid is a canvas (cells addressed
 * via header strips); the menu + composer are real DOM.
 */

const rowHeader = (page: Page, n: number) =>
    page.locator('.row-header').filter({hasText: new RegExp(`^${n}$`)})
const colHeader = (page: Page, name: string) =>
    page.locator('.column-header').filter({hasText: new RegExp(`^${name}$`)})

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

async function rightClickCell(page: Page, col: string, row: number) {
    const c = await cellCenter(page, col, row)
    await page.mouse.click(c.x, c.y, {button: 'right'})
}

async function typeIntoCell(page: Page, col: string, row: number, text: string) {
    const c = await cellCenter(page, col, row)
    await page.mouse.click(c.x, c.y)
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(250)
}

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

const dialog = (page: Page) => page.getByRole('dialog')

// Create a 1×1 form block named "people" at B2 via the toolbar CreateBlock
// composer (the create path commits temp status, so the block is immediately
// visible to the worksheet block queries the edit hit-test relies on). The
// default composer seeds one field ("Customer Status"). This is the setup every
// edit test starts from.
async function createPeopleBlock(page: Page) {
    const c = await cellCenter(page, 'B', 2)
    await page.mouse.click(c.x, c.y)
    await page.getByRole('button', {name: 'CreateBlock'}).click()

    const d = dialog(page)
    await expect(d).toBeVisible({timeout: 10_000})
    await d.getByPlaceholder(/customers/i).fill('people')
    await d.getByRole('button', {name: /save changes/i}).click()
    await expect(page.getByText(/configured successfully/i)).toBeVisible({
        timeout: 15_000,
    })
    await expect(d).toBeHidden({timeout: 15_000})
    await expect(page.getByTestId('block-interface').first()).toBeVisible({
        timeout: 15_000,
    })
}

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await waitForGrid(page)
})

test('right-clicking inside a block offers "Edit block…" and opens the composer pre-filled', async ({
    page,
}) => {
    await createPeopleBlock(page)

    // Right-click the cell inside the block → the async block hit-test resolves
    // and the "Edit block…" item appears.
    await rightClickCell(page, 'B', 2)
    const edit = page.getByRole('menuitem', {name: /edit block/i})
    await expect(edit).toBeVisible({timeout: 10_000})
    await edit.click()

    // Composer opens in edit mode, pre-filled: ref name "people" + the existing
    // field (the default "Customer Status").
    const d = dialog(page)
    await expect(d).toBeVisible({timeout: 10_000})
    await expect(d.getByPlaceholder(/customers/i)).toHaveValue('people')
    const existing = d.getByRole('button', {name: /Customer Status/i})
    await expect(existing).toBeVisible()

    // Selecting an existing field opens its config, pre-filled and editable
    // (existing fields can now be re-typed/renamed; only deletion is barred).
    await existing.click()
    await expect(d.getByLabel('Field Name')).toHaveValue('Customer Status')
})

test('appending a field and saving runs editFormBlock end-to-end', async ({
    page,
}) => {
    await createPeopleBlock(page)

    await rightClickCell(page, 'B', 2)
    await page.getByRole('menuitem', {name: /edit block/i}).click()

    const d = dialog(page)
    await expect(d).toBeVisible({timeout: 10_000})

    // Append a new field (defaults to a String field named "New Field"). Anchor
    // the regex so it matches the new field-list item, not the "Add New Field"
    // button.
    await d.getByRole('button', {name: /add new field/i}).click()
    await expect(d.getByRole('button', {name: /^New Field/i})).toBeVisible()

    // Save. The composer's edit path awaits `ops.editFormBlock` and only shows
    // this success toast (and closes) if the whole transaction — tail resize +
    // re-bindFormSchema + upsertFieldRenderInfo — resolved without the engine
    // rejecting it. So this single assertion proves the end-to-end edit path.
    await d.getByRole('button', {name: /save changes/i}).click()
    await expect(page.getByText(/updated successfully/i)).toBeVisible({
        timeout: 15_000,
    })
    await expect(d).toBeHidden({timeout: 15_000})
    await expect(page.getByText(/failed/i)).toHaveCount(0)

    // The block still renders after the resize + rebind.
    await expect(page.getByTestId('block-interface').first()).toBeVisible({
        timeout: 15_000,
    })
})

// A block created via "Convert to block…" (a `convertBlock` payload) is also
// editable. NOTE: there is a deterministic ~sub-second window right after the
// convert dialog closes where `getAllBlocks` transiently returns [] (the block
// is committed — it shows up immediately in a query from inside the composer —
// but a post-convert recompute/re-sync briefly empties the query result before
// it recovers). Create/toolbar blocks don't hit this (no cell recompute). A
// real user right-clicks seconds later, so this is invisible to them; the test
// re-opens the menu until the item appears to ride over that transient.
test('a block created via "Convert to block…" is also editable', async ({
    page,
}) => {
    // Build a 2-column table and convert B2:C4 into a block named "team".
    await typeIntoCell(page, 'B', 2, 'Name')
    await typeIntoCell(page, 'C', 2, 'Age')
    await typeIntoCell(page, 'B', 3, 'Alice')
    await typeIntoCell(page, 'C', 3, '30')
    await typeIntoCell(page, 'B', 4, 'Bob')
    await typeIntoCell(page, 'C', 4, '25')
    await selectRange(page, 'B', 2, 'C', 4)
    await rightClickCell(page, 'C', 3)
    await page.getByRole('menuitem', {name: /convert to block/i}).click()

    const d = dialog(page)
    await expect(d).toBeVisible({timeout: 10_000})
    await d.getByPlaceholder(/customers/i).fill('team')
    await d.getByRole('button', {name: /save changes/i}).click()
    await expect(page.getByText(/configured successfully/i)).toBeVisible({
        timeout: 15_000,
    })
    await expect(d).toBeHidden({timeout: 15_000})

    // Right-click a data cell inside the converted block → "Edit block…" shows.
    // Re-open the menu until it appears, to ride over the post-convert transient.
    await expect(async () => {
        await page.keyboard.press('Escape').catch(() => {})
        await rightClickCell(page, 'C', 3)
        await expect(
            page.getByRole('menuitem', {name: /edit block/i})
        ).toBeVisible({timeout: 800})
    }).toPass({timeout: 10_000})
})
