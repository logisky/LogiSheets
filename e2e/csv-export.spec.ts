import {test, expect, type Page} from '@playwright/test'
import {readFileSync} from 'fs'

/**
 * End-to-end coverage for File → "Export as CSV", which calls the engine
 * capability `DataService.exportSheetToCsv` (packages/engine) and downloads the
 * result. Verifies the actual downloaded bytes: values, row-major order, and
 * RFC 4180 quoting of a field containing a comma.
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
    await page.waitForTimeout(250)
}

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await waitForGrid(page)
})

test('File → Export as CSV downloads the sheet as RFC 4180 CSV', async ({
    page,
}) => {
    // A1:B2 header + a row; A3 contains a comma so it must be quoted.
    await typeIntoCell(page, 'A', 1, 'Name')
    await typeIntoCell(page, 'B', 1, 'Age')
    await typeIntoCell(page, 'A', 2, 'Alice')
    await typeIntoCell(page, 'B', 2, '30')
    await typeIntoCell(page, 'A', 3, 'a,b')

    await page.getByRole('button', {name: /^File$/}).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('menuitem', {name: /export as csv/i}).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.csv$/)
    const path = await download.path()
    // Strip the UTF-8 BOM the exporter prepends for Excel.
    const csv = readFileSync(path, 'utf8').replace(/^﻿/, '')

    expect(csv).toBe(['Name,Age', 'Alice,30', '"a,b",'].join('\r\n'))
})
