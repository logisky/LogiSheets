import {test, expect, type Page} from '@playwright/test'

/**
 * End-to-end coverage for cross-sheet references while editing a formula
 * (Excel "point mode" across sheets).
 *
 * When a formula edit is in progress and the user switches to another sheet,
 * the in-cell editor must STAY OPEN (it doesn't commit on blur — see the
 * `onBlur` guard in `packages/formula-editor/src/lib/inline.ts`). A floating
 * reminder (`src/components/formula-edit-reminder`) then names the edited cell
 * and mirrors the live formula, and clicking a cell on the other sheet inserts
 * a sheet-qualified reference (`Sheet2!…`). Confirm/Cancel end the edit. The
 * cross-view routing is tracked by `src/core/formula-edit-coordinator.ts`.
 *
 * These drive the real DOM: sheet tabs are MUI <Tab role="tab"> buttons, the
 * add-sheet button is `aria-label="add sheet"`, and the reminder carries a
 * `data-testid`. The grid itself is a canvas, so a formula is started by
 * clicking a cell and typing '='.
 */

const gridCanvas = (page: Page) => page.locator('canvas.main-canvas').first()
const sheetTab = (page: Page, name: string) =>
    page.getByRole('tab', {name, exact: true})
const addSheetBtn = (page: Page) =>
    page.getByRole('button', {name: 'add sheet'})
const reminder = (page: Page) => page.getByTestId('formula-edit-reminder')
// The open in-cell editor carries this class; used as a signal that the editor
// actually opened before we navigate away.
const inCellEditor = (page: Page) =>
    page.locator('.logisheets-inline-cell-editor')

// Two distinct on-canvas positions -> two distinct cells. The reference click
// must land on a DIFFERENT cell than the edited one, otherwise the view's
// selection doesn't change and no reference is emitted.
const EDIT_CELL_POS = {x: 150, y: 120}
const REF_CELL_POS = {x: 340, y: 220}

async function waitForGrid(page: Page) {
    await expect(page.locator('canvas').first()).toBeVisible({timeout: 30_000})
    await expect(sheetTab(page, 'Sheet1')).toBeVisible({timeout: 30_000})
}

/**
 * Add Sheet2, return to Sheet1, open an in-cell formula edit on a cell, then
 * switch to Sheet2 — leaving the editor in cross-sheet point mode.
 */
async function enterCrossSheetPointMode(page: Page) {
    // Add a second sheet (auto-selects it), then switch back to Sheet1.
    await addSheetBtn(page).click()
    await expect(sheetTab(page, 'Sheet2')).toBeVisible()
    await sheetTab(page, 'Sheet1').click()

    // Select a cell and start a formula by typing '='.
    await gridCanvas(page).click({position: EDIT_CELL_POS})
    await page.keyboard.type('=')
    // The in-cell editor must be open before we navigate away.
    await expect(inCellEditor(page)).toBeVisible()

    // Switch to Sheet2 — point mode: the editor must NOT commit on this blur.
    await sheetTab(page, 'Sheet2').click()
}

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await waitForGrid(page)
})

test('switching sheets mid-formula keeps the editor open and shows a reminder', async ({
    page,
}) => {
    await enterCrossSheetPointMode(page)

    // The reminder appears (proof the edit did NOT commit on the sheet switch),
    // names the edited cell on Sheet1, and mirrors the live formula ("=").
    await expect(reminder(page)).toBeVisible()
    await expect(reminder(page)).toContainText('Sheet1!')
    await expect(reminder(page)).toContainText('=')
})

test('clicking a cell on another sheet inserts a sheet-qualified reference', async ({
    page,
}) => {
    await enterCrossSheetPointMode(page)
    await expect(reminder(page)).toBeVisible()

    // Click a DIFFERENT cell on Sheet2 — the reference is qualified into the
    // formula, visible in the reminder's live-formula readout.
    await gridCanvas(page).click({position: REF_CELL_POS})
    await expect(reminder(page)).toContainText('Sheet2!')
})

test('Confirm commits the cross-sheet formula and dismisses the reminder', async ({
    page,
}) => {
    await enterCrossSheetPointMode(page)
    await gridCanvas(page).click({position: REF_CELL_POS})
    await expect(reminder(page)).toContainText('Sheet2!')

    await page.getByRole('button', {name: 'Confirm (Enter)'}).click()
    await expect(reminder(page)).toHaveCount(0)
})

test('Cancel dismisses the edit without committing', async ({page}) => {
    await enterCrossSheetPointMode(page)
    await expect(reminder(page)).toBeVisible()

    await page.getByRole('button', {name: 'Cancel (Esc)'}).click()
    await expect(reminder(page)).toHaveCount(0)
})
