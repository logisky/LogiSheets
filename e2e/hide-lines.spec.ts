import {test, expect, type Page} from '@playwright/test'
import {createBlockButton} from './toolbar'

/**
 * Hiding and unhiding rows / columns from the header menu, and hiding a whole
 * block from its gear menu. A hidden line is simply absent from the headers,
 * so the header buttons are what these tests read.
 */

const rowHeader = (page: Page, n: number) =>
    page.locator('.row-header').filter({hasText: new RegExp(`^${n}$`)})
const colHeader = (page: Page, name: string) =>
    page.locator('.column-header').filter({hasText: new RegExp(`^${name}$`)})
const menuItem = (page: Page, name: string) =>
    page.getByRole('menu').getByRole('menuitem', {name, exact: true})
const blockOutline = (page: Page) => page.getByTestId('block-interface').first()

/** Select a run of headers the way a user does: drag from one to the other. */
async function dragHeaders(
    page: Page,
    from: ReturnType<Page['locator']>,
    to: ReturnType<Page['locator']>
) {
    const a = await from.boundingBox()
    const b = await to.boundingBox()
    await page.mouse.move(a!.x + a!.width / 2, a!.y + a!.height / 2)
    await page.mouse.down()
    await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2, {
        steps: 5,
    })
    await page.mouse.up()
}

async function waitForGrid(page: Page) {
    await expect(page.locator('canvas').first()).toBeVisible({timeout: 30_000})
    await expect(rowHeader(page, 1)).toBeVisible({timeout: 30_000})
}

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await waitForGrid(page)
})

test('hide a row range, then unhide it from the row beside it', async ({
    page,
}) => {
    await dragHeaders(page, rowHeader(page, 3), rowHeader(page, 4))
    await rowHeader(page, 4).click({button: 'right'})
    await menuItem(page, 'Hide rows').click()

    await expect(rowHeader(page, 3)).toHaveCount(0)
    await expect(rowHeader(page, 4)).toHaveCount(0)
    await expect(rowHeader(page, 2)).toBeVisible()
    await expect(rowHeader(page, 5)).toBeVisible()
    // Row 5 now sits directly under row 2.
    const r2 = await rowHeader(page, 2).boundingBox()
    const r5 = await rowHeader(page, 5).boundingBox()
    expect(Math.abs(r5!.y - (r2!.y + r2!.height))).toBeLessThan(2)
    // The boundary carries the hidden-line marker.
    await expect(page.locator('.row-headers .hidden-marker')).toHaveCount(1)

    // The hidden rows cannot be clicked; their neighbour brings them back.
    await rowHeader(page, 5).click({button: 'right'})
    await menuItem(page, 'Unhide rows').click()
    await expect(rowHeader(page, 3)).toBeVisible()
    await expect(rowHeader(page, 4)).toBeVisible()
})

test('the headers stay on the grid after a column menu action', async ({
    page,
}) => {
    // Closing the menu hands focus back to a header button; that used to
    // scroll the header strip and slide every label off its column.
    await rowHeader(page, 3).click({button: 'right'})
    await menuItem(page, 'Hide rows').click()
    await colHeader(page, 'C').click({button: 'right'})
    await menuItem(page, 'Hide columns').click()
    await expect(colHeader(page, 'C')).toHaveCount(0)
    await page.waitForTimeout(300)
    const strip = await page.locator('.column-headers').boundingBox()
    const a = await colHeader(page, 'A').boundingBox()
    expect(Math.abs(a!.x - strip!.x)).toBeLessThan(1)
})

test('a hidden first column comes back from the column after it', async ({
    page,
}) => {
    await colHeader(page, 'A').click({button: 'right'})
    await menuItem(page, 'Hide columns').click()
    await expect(colHeader(page, 'A')).toHaveCount(0)
    await expect(colHeader(page, 'B')).toBeVisible()
    // At the sheet's edge too: nothing is scrolled, so it must be hidden.
    await expect(page.locator('.column-headers .hidden-marker')).toHaveCount(1)

    await colHeader(page, 'B').click({button: 'right'})
    await menuItem(page, 'Unhide columns').click()
    await expect(colHeader(page, 'A')).toBeVisible()
    await expect(page.locator('.column-headers .hidden-marker')).toHaveCount(0)
})

test('hiding is one undo step', async ({page}) => {
    await dragHeaders(page, colHeader(page, 'C'), colHeader(page, 'E'))
    await colHeader(page, 'D').click({button: 'right'})
    await menuItem(page, 'Hide columns').click()
    for (const c of ['C', 'D', 'E'])
        await expect(colHeader(page, c)).toHaveCount(0)

    await page.getByRole('button', {name: /undo/i}).first().click()
    for (const c of ['C', 'D', 'E'])
        await expect(colHeader(page, c)).toBeVisible()
})

async function createBlockAtB3(page: Page) {
    const ch = await colHeader(page, 'B').boundingBox()
    const rh = await rowHeader(page, 3).boundingBox()
    const x = ch!.x + ch!.width / 2
    const y = rh!.y + rh!.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 3, y + 3, {steps: 3})
    await page.mouse.up()

    const create = await createBlockButton(page)
    await expect(create).toBeEnabled()
    await create.click()
    await page.getByPlaceholder(/customers/i).fill('hide-test')
    await page.getByRole('button', {name: /save changes/i}).click()
    await expect(blockOutline(page)).toBeVisible({timeout: 15_000})
}

async function openGearMenu(page: Page) {
    const b = await blockOutline(page).boundingBox()
    await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2)
    const gear = blockOutline(page).locator('[data-testid="SettingsIcon"]')
    await expect(gear).toBeVisible({timeout: 10_000})
    await gear.click()
}

for (const [label, gone, kept] of [
    ['Hide block (by rows)', () => ['row', 3], () => ['col', 'B']],
    ['Hide block (by columns)', () => ['col', 'B'], () => ['row', 3]],
] as const) {
    test(`gear menu → "${label}"`, async ({page}) => {
        await createBlockAtB3(page)
        await openGearMenu(page)
        await menuItem(page, label).click()

        const header = ([axis, id]: readonly [string, string | number]) =>
            axis === 'row'
                ? rowHeader(page, id as number)
                : colHeader(page, id as string)
        await expect(header(gone())).toHaveCount(0)
        await expect(header(kept())).toBeVisible()
        await expect(page.getByTestId('block-interface')).toHaveCount(0)
    })
}
