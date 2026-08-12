import {test, expect, type Page} from '@playwright/test'

/**
 * End-to-end coverage for the sheet-switching keyboard shortcut.
 *
 * The engine (packages/engine — shortcuts.ts + Spreadsheet.svelte) binds
 * Ctrl/⌘+PageDown to "next sheet" and Ctrl/⌘+PageUp to "previous sheet" (the
 * Excel / Google Sheets convention). The grid captures the chord while focused,
 * switches the active sheet (no wrap at the ends), and fires onActiveSheetChange
 * — which the app's own sheet tabs (src/components/sheets-tab, MUI Tabs with
 * showSheetTabs:false on the engine) reflect via `aria-selected`.
 *
 * `ControlOrMeta` maps to ⌘ on macOS and Ctrl elsewhere, matching the engine's
 * `primaryPressed` (metaKey on Apple platforms, ctrlKey otherwise), so this test
 * is correct on both the local Mac and the Linux CI runner.
 */

/**
 * The engine's primary modifier is ⌘ on Apple platforms, Ctrl elsewhere — and
 * it decides that from `navigator.userAgentData?.platform ?? navigator.platform`
 * (see `isApplePlatform` in packages/engine/.../shortcuts.ts). Playwright's
 * bundled Chromium reports `userAgentData.platform === 'Windows'` even on macOS,
 * so we mirror the SAME check in the page to press exactly what the engine
 * expects — rather than guessing from the host OS.
 */
async function primaryModifier(page: Page): Promise<'Meta' | 'Control'> {
    const isApple = await page.evaluate(() => {
        const p =
            (navigator as {userAgentData?: {platform?: string}}).userAgentData
                ?.platform ??
            navigator.platform ??
            ''
        return /mac|iphone|ipad|ipod/i.test(p)
    })
    return isApple ? 'Meta' : 'Control'
}

const gridCanvas = (page: Page) => page.locator('canvas.main-canvas').first()
const sheetTab = (page: Page, name: string) =>
    page.getByRole('tab', {name, exact: true})
const addSheetBtn = (page: Page) =>
    page.getByRole('button', {name: 'add sheet'})

async function waitForGrid(page: Page) {
    await expect(page.locator('canvas').first()).toBeVisible({timeout: 30_000})
    await expect(sheetTab(page, 'Sheet1')).toBeVisible({timeout: 30_000})
}

/** The MUI Tab for `name` is the selected one. */
async function expectActiveSheet(page: Page, name: string) {
    await expect(sheetTab(page, name)).toHaveAttribute('aria-selected', 'true')
}

/**
 * Add Sheet2 + Sheet3, then land on Sheet1 with the grid focused. We click
 * Sheet1 explicitly (rather than relying on which sheet "add" leaves selected)
 * so the shortcut navigation below starts from a known state, then click a cell
 * so the engine's keydown handler receives the chord.
 */
async function threeSheetsFocusedOnSheet1(page: Page) {
    await addSheetBtn(page).click()
    await expect(sheetTab(page, 'Sheet2')).toBeVisible()
    await addSheetBtn(page).click()
    await expect(sheetTab(page, 'Sheet3')).toBeVisible()

    await sheetTab(page, 'Sheet1').click()
    await expectActiveSheet(page, 'Sheet1')

    // Focus the grid; selecting a cell must not change the active sheet.
    await gridCanvas(page).click({position: {x: 150, y: 120}})
    await expectActiveSheet(page, 'Sheet1')
}

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await waitForGrid(page)
})

test('Ctrl/⌘+PageDown / PageUp switches to the next / previous sheet', async ({
    page,
}) => {
    const primary = await primaryModifier(page)
    await threeSheetsFocusedOnSheet1(page)

    // Next sheet: Sheet1 -> Sheet2 -> Sheet3.
    await page.keyboard.press(`${primary}+PageDown`)
    await expectActiveSheet(page, 'Sheet2')
    await page.keyboard.press(`${primary}+PageDown`)
    await expectActiveSheet(page, 'Sheet3')

    // Previous sheet: Sheet3 -> Sheet2 -> Sheet1.
    await page.keyboard.press(`${primary}+PageUp`)
    await expectActiveSheet(page, 'Sheet2')
    await page.keyboard.press(`${primary}+PageUp`)
    await expectActiveSheet(page, 'Sheet1')
})

test('the shortcut does not wrap past the first / last sheet', async ({
    page,
}) => {
    const primary = await primaryModifier(page)
    await threeSheetsFocusedOnSheet1(page)

    // At the first sheet, "previous" is a no-op (no wrap to the last sheet).
    await page.keyboard.press(`${primary}+PageUp`)
    await expectActiveSheet(page, 'Sheet1')

    // Walk to the last sheet, then "next" is a no-op there too.
    await page.keyboard.press(`${primary}+PageDown`)
    await page.keyboard.press(`${primary}+PageDown`)
    await expectActiveSheet(page, 'Sheet3')
    await page.keyboard.press(`${primary}+PageDown`)
    await expectActiveSheet(page, 'Sheet3')
})
