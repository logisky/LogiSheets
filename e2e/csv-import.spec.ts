import {test, expect, type Page} from '@playwright/test'
import {readFileSync} from 'fs'

/**
 * File → "Import CSV…" adds the file as a new sheet and shows it. Checked by
 * exporting that sheet back out: what comes out is what the cells hold.
 */

const rowHeader = (page: Page, n: number) =>
    page.locator('.row-header').filter({hasText: new RegExp(`^${n}$`)})

async function waitForGrid(page: Page) {
    await expect(page.locator('canvas').first()).toBeVisible({timeout: 30_000})
    await expect(rowHeader(page, 1)).toBeVisible({timeout: 30_000})
}

async function importCsv(page: Page, name: string, bytes: Buffer) {
    await page.getByTestId('csv-import-input').setInputFiles({
        name,
        mimeType: 'text/csv',
        buffer: bytes,
    })
}

async function exportCurrentSheet(page: Page): Promise<string> {
    await page.getByRole('button', {name: /^File$/}).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('menuitem', {name: /export as csv/i}).click()
    const path = await (await downloadPromise).path()
    return readFileSync(path, 'utf8').replace(/^\ufeff/, '')
}

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await waitForGrid(page)
})

test('the menu item opens a CSV picker', async ({page}) => {
    await page.getByRole('button', {name: /^File$/}).click()
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('menuitem', {name: /import csv/i}).click()
    expect((await chooser).isMultiple()).toBe(false)
})

test('imports into a new sheet named after the file, as data', async ({
    page,
}) => {
    await importCsv(
        page,
        'orders.csv',
        Buffer.from(
            'item,qty,note\r\n"Pear, green",3,"say ""hi"""\r\nFig,,=1+1\r\n'
        )
    )
    await expect(page.getByRole('tab', {name: 'orders'})).toBeVisible()
    await expect(page.getByRole('tab', {name: 'orders'})).toHaveAttribute(
        'aria-selected',
        'true'
    )
    await expect(page.getByText(/Imported 3 rows/)).toBeVisible()

    // `=1+1` stays text: a formula would export as 2.
    expect(await exportCurrentSheet(page)).toBe(
        ['item,qty,note', '"Pear, green",3,"say ""hi"""', 'Fig,,=1+1'].join(
            '\r\n'
        )
    )
})

test('reads a semicolon-separated GBK file and numbers a repeated name', async ({
    page,
}) => {
    // "名称;数量\r\n苹果;5" in GBK, as Chinese-locale Excel saves CSV.
    const gbk = Buffer.from([
        0xc3, 0xfb, 0xb3, 0xc6, 0x3b, 0xca, 0xfd, 0xc1, 0xbf, 0x0d, 0x0a, 0xc6,
        0xbb, 0xb9, 0xfb, 0x3b, 0x35,
    ])
    await importCsv(page, 'Sheet1.csv', gbk)
    await expect(page.getByRole('tab', {name: 'Sheet1 (2)'})).toBeVisible()
    expect(await exportCurrentSheet(page)).toBe('名称,数量\r\n苹果,5')
})
