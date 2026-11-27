import {test, expect, type Page} from '@playwright/test'

/**
 * A highlighted cell is a cell you can type into.
 *
 * Selecting focuses the view (`Session.setSelection` → `focusGrid`), so a jump
 * from outside the grid — the name box, a craft, Go To, a link — leaves the
 * keyboard on the grid and the next keystroke edits the selected cell. And the
 * selection is drawn blue only while that is true: once focus leaves the view
 * it turns grey (`.selector.inactive`), and blue again when focus returns.
 *
 * The exception is a find bar (`data-keeps-focus`): each hit moves the
 * selection while the user keeps typing the query.
 *
 * Tagged @webkit: the desktop app runs on WebKit, where focus moving between
 * documents and elements is the part most likely to differ.
 */

const gridCanvas = (page: Page) => page.locator('canvas.main-canvas').first()
const selector = (page: Page) => page.locator('.selector').first()
const nameBox = (page: Page) => page.getByRole('combobox', {name: 'Name box'})
const inCellEditor = (page: Page) =>
    page.locator('.logisheets-inline-cell-editor')
const canvasFocused = (page: Page) =>
    page.evaluate(() =>
        document.activeElement?.classList.contains('main-canvas')
    )

async function open(page: Page) {
    await page.goto('/?lang=en')
    await expect(gridCanvas(page)).toBeVisible({timeout: 30_000})
    // The first click can land before the grid is ready to select.
    await expect(async () => {
        await gridCanvas(page).click({position: {x: 150, y: 120}})
        await expect(selector(page)).toBeVisible({timeout: 1_000})
    }).toPass({timeout: 20_000})
}

async function jumpWithNameBox(page: Page, address: string) {
    await nameBox(page).click()
    await nameBox(page).fill(address)
    await nameBox(page).press('Enter')
}

test.describe('selection takes the keyboard @webkit', () => {
    test('a name-box jump leaves typing on the grid', async ({page}) => {
        await open(page)
        await jumpWithNameBox(page, 'D7')
        await expect.poll(() => canvasFocused(page)).toBe(true)
        await expect(nameBox(page)).toHaveValue('D7')
        await expect(selector(page)).not.toHaveClass(/inactive/)
        const cell = await selector(page).boundingBox()
        // The very next keystroke edits D7: the editor opens over it.
        await page.keyboard.type('42')
        await expect(inCellEditor(page)).toBeVisible()
        await expect(inCellEditor(page).locator('.cm-content')).toHaveText('42')
        const ed = await inCellEditor(page).boundingBox()
        expect(Math.abs(ed!.x - cell!.x)).toBeLessThan(4)
        expect(Math.abs(ed!.y - cell!.y)).toBeLessThan(4)
    })

    test('jumping to the cell already selected still takes focus', async ({
        page,
    }) => {
        await open(page)
        const here = await nameBox(page).inputValue()
        await jumpWithNameBox(page, here)
        await expect.poll(() => canvasFocused(page)).toBe(true)
        await page.keyboard.type('x')
        await expect(inCellEditor(page)).toBeVisible()
    })

    test('the selection greys out while the keyboard is elsewhere', async ({
        page,
    }) => {
        await open(page)
        await expect(selector(page)).not.toHaveClass(/inactive/)
        // Focus the name box without committing anything.
        await nameBox(page).focus()
        await expect(selector(page)).toHaveClass(/inactive/)
        await gridCanvas(page).click({position: {x: 150, y: 120}})
        await expect(selector(page)).not.toHaveClass(/inactive/)
    })

    test('typing in a cell keeps the selection blue', async ({page}) => {
        await open(page)
        await page.keyboard.type('a')
        await expect(inCellEditor(page)).toBeVisible()
        // Focus is in the in-cell editor, which is part of the view.
        await expect(selector(page)).not.toHaveClass(/inactive/)
    })

    test('find keeps its own focus, then hands it back', async ({page}) => {
        await open(page)
        // Two hits, so each Enter in the find bar moves the selection.
        // A commit settles asynchronously: wait for each to finish moving the
        // selection, or the next keystrokes land in the same cell.
        for (let i = 0; i < 2; i++) {
            await page.keyboard.type('x')
            await page.keyboard.press('Enter')
            await expect(inCellEditor(page)).toHaveCount(0)
            await expect.poll(() => canvasFocused(page)).toBe(true)
        }
        const before = await nameBox(page).inputValue()
        // The toolbar button: ⌘F never reaches the page in headless Chromium
        // on macOS.
        await page.getByRole('button', {name: 'Find', exact: true}).click()
        const query = page.getByPlaceholder('Find')
        await expect(query).toBeFocused()
        await query.fill('x')
        // The search runs asynchronously; Enter before it lands is a no-op.
        await expect(page.getByText('2 found')).toBeVisible()
        await query.press('Enter')
        await expect(nameBox(page)).not.toHaveValue(before)
        // The selection moved to a hit, yet typing stays in the find bar —
        // and the grid shows it is not the one listening.
        await expect(query).toBeFocused()
        await expect(selector(page)).toHaveClass(/inactive/)
        await query.press('Escape')
        await expect.poll(() => canvasFocused(page)).toBe(true)
        await expect(selector(page)).not.toHaveClass(/inactive/)
    })
})
