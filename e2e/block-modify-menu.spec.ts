import {test, expect, type Page} from '@playwright/test'

/**
 * The block gear menu's "Modify" action opens the block composer in edit mode
 * over the block (rename + append fields; existing fields are read-only). This
 * was previously a `// todo` no-op — this spec pins the wiring.
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

async function createBlockAt(page: Page, col: string, row: number, name: string) {
    const start = await cellCenter(page, col, row)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 3, start.y + 3, {steps: 3})
    await page.mouse.up()

    const create = page.getByRole('button', {name: /CreateBlock/i})
    await expect(create).toBeEnabled()
    await create.click()
    await page.getByPlaceholder(/customers/i).fill(name)
    await page.getByRole('button', {name: /save changes/i}).click()
    await expect(blockOutline(page)).toBeVisible({timeout: 15_000})
}

async function hoverBlock(page: Page) {
    const b = await blockOutline(page).boundingBox()
    if (!b) throw new Error('no block outline box')
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
}

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await waitForGrid(page)
})

test('gear menu → "Modify" opens the composer in edit mode, pre-filled', async ({
    page,
}) => {
    await createBlockAt(page, 'B', 3, 'mod-test')

    // Open the block gear menu and pick "Modify".
    await hoverBlock(page)
    const gear = blockOutline(page).locator('[data-testid="SettingsIcon"]')
    await expect(gear).toBeVisible({timeout: 10_000})
    await gear.click()

    await page.getByRole('menuitem', {name: /modify/i}).click()

    // The composer opens in edit mode: ref name pre-filled + the existing field
    // present and read-only.
    const d = page.getByRole('dialog')
    await expect(d).toBeVisible({timeout: 10_000})
    await expect(d.getByPlaceholder(/customers/i)).toHaveValue('mod-test')
    const existing = d.getByRole('button', {name: /Customer Status/i})
    await expect(existing).toBeVisible()
    await existing.click()
    await expect(d.getByText(/Existing field/i)).toBeVisible()
})
