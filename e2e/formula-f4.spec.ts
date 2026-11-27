import {test, expect, type Page} from '@playwright/test'

/**
 * F4 cycles the reference under the cursor through its four forms, press
 * after press, and every form stays highlighted as a reference.
 *
 * The cycle (`cycleReferenceUnderCursor` in packages/formula-editor) only acts
 * on a token the display lexer marked `cellReference`. The lexer used to choke
 * on `$` — `$B$4` came back with no tokens — so the first F4 worked and every
 * later one did nothing, with the reference left unhighlighted.
 */

const gridCanvas = (page: Page) => page.locator('canvas.main-canvas').first()
const editor = (page: Page) =>
    page.locator('.logisheets-inline-cell-editor .cm-content')
const highlighted = (page: Page) => editor(page).locator('.cm-formula-cellref')

test('F4 cycles a reference through all four forms @webkit', async ({page}) => {
    await page.goto('/')
    await expect(gridCanvas(page)).toBeVisible({timeout: 30_000})
    // The first click can land before the grid is ready to select.
    await expect(async () => {
        await gridCanvas(page).click({position: {x: 150, y: 120}})
        await expect(page.locator('.selector').first()).toBeVisible({
            timeout: 1_000,
        })
    }).toPass({timeout: 20_000})
    await page.keyboard.type('=B4', {delay: 50})
    await expect(editor(page)).toHaveText('=B4')
    // Tokens come back from the engine worker after each edit; F4 acts on
    // them, so wait until the reference is recognised (highlighted).
    await expect(highlighted(page)).toHaveText(['B4'])

    for (const form of ['$B$4', 'B$4', '$B4', 'B4']) {
        await page.keyboard.press('F4')
        await expect(editor(page)).toHaveText(`=${form}`)
        await expect(highlighted(page)).toHaveText([form])
    }
})
