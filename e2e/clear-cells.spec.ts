import {test, expect, type Page} from '@playwright/test'

/**
 * Backspace and Delete on a selected cell empty it, right there, as Google
 * Sheets and Mac Excel do: no editor opens. Backspace used to open an empty
 * editor (Windows Excel's behaviour), which looked like the key was broken,
 * and only ever touched the active cell, never the rest of a range.
 */

const gridCanvas = (page: Page) => page.locator('canvas.main-canvas').first()
const selector = (page: Page) => page.locator('.selector').first()
const inCellEditor = (page: Page) =>
    page.locator('.logisheets-inline-cell-editor')

async function open(page: Page) {
    await page.goto('/?lang=en')
    await expect(gridCanvas(page)).toBeVisible({timeout: 30_000})
    // The first click can land before the grid is ready to select.
    await expect(async () => {
        await gridCanvas(page).click({position: {x: 150, y: 120}})
        await expect(selector(page)).toBeVisible({timeout: 1_000})
    }).toPass({timeout: 20_000})
}

const nameBox = (page: Page) => page.getByRole('combobox', {name: 'Name box'})

/** Type `text` into the selected cell and commit it, moving down. */
async function enter(page: Page, text: string) {
    const at = await nameBox(page).inputValue()
    await page.keyboard.type(text)
    await expect(inCellEditor(page)).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(inCellEditor(page)).toHaveCount(0)
    // The move down lands asynchronously; an arrow pressed before it would
    // be undone by it.
    await expect(nameBox(page)).not.toHaveValue(at)
}

/** What F2 shows for the selected cell: its formula or text. */
async function contentOfSelected(page: Page) {
    await page.keyboard.press('F2')
    await expect(inCellEditor(page)).toBeVisible()
    const text = await inCellEditor(page).locator('.cm-content').innerText()
    await page.keyboard.press('Escape')
    await expect(inCellEditor(page)).toHaveCount(0)
    return text.trim()
}

test.describe('clearing cells from the keyboard @webkit', () => {
    for (const key of ['Backspace', 'Delete']) {
        test(`${key} empties the cell without opening the editor`, async ({
            page,
        }) => {
            await open(page)
            await enter(page, '42')
            await page.keyboard.press('ArrowUp')
            // The commit lands asynchronously.
            await expect.poll(() => contentOfSelected(page)).toBe('42')

            await page.keyboard.press(key)
            await expect(inCellEditor(page)).toHaveCount(0)
            await expect.poll(() => contentOfSelected(page)).toBe('')
        })
    }

    test('Backspace empties the whole selected range', async ({page}) => {
        await open(page)
        await enter(page, '1')
        await enter(page, '2')
        await page.keyboard.press('ArrowUp')
        await expect.poll(() => contentOfSelected(page)).toBe('2')
        await page.keyboard.press('Shift+ArrowUp')
        await page.keyboard.press('Backspace')
        await expect(inCellEditor(page)).toHaveCount(0)

        await page.keyboard.press('ArrowDown')
        await expect.poll(() => contentOfSelected(page)).toBe('')
        await page.keyboard.press('ArrowUp')
        await expect.poll(() => contentOfSelected(page)).toBe('')
    })
})
