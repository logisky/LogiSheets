import {test, expect, type Page} from '@playwright/test'

/**
 * The formula autocomplete list must be VISIBLE, not just present, while
 * typing a formula straight into a cell — in WebKit too (the macOS desktop app
 * runs on it).
 *
 * The in-cell editor is a one-cell-tall box with `overflow: hidden`. Chromium
 * renders CodeMirror's tooltips `position: fixed` and escapes that clip, but
 * under WebKit CodeMirror falls back to `position: absolute`, which left the
 * list clipped away entirely while the DOM still called it visible. The fix
 * mounts tooltips in the document body (`tooltips({parent})` in
 * `packages/formula-editor/src/lib/editor.ts`). So these tests assert what is
 * painted — the topmost element at the list's position is the list — rather
 * than `toBeVisible()`, which passed on the broken build.
 *
 * Tagged @webkit: the WebKit project in playwright.config.ts runs only these.
 */

const gridCanvas = (page: Page) => page.locator('canvas.main-canvas').first()
const editor = (page: Page) =>
    page.locator('.logisheets-inline-cell-editor .cm-content')
const completions = (page: Page) => page.locator('.cm-tooltip-autocomplete')

async function startFormula(page: Page, text: string) {
    await page.goto('/')
    await expect(gridCanvas(page)).toBeVisible({timeout: 30_000})
    // The first click can land before the grid is ready to select.
    await expect(async () => {
        await gridCanvas(page).click({position: {x: 150, y: 120}})
        await expect(page.locator('.selector').first()).toBeVisible({
            timeout: 1_000,
        })
    }).toPass({timeout: 20_000})
    // Real keystrokes: the first one opens the editor (type-to-edit), the
    // rest go into it.
    await page.keyboard.type(text, {delay: 50})
    await expect(editor(page)).toHaveText(text)
    await expect(completions(page)).toBeVisible()
}

/** Whether the list is what the user sees at its own centre. */
function paintedOnTop(page: Page) {
    return completions(page).evaluate((ac) => {
        const r = ac.getBoundingClientRect()
        const hit = ac.ownerDocument.elementFromPoint(
            r.left + r.width / 2,
            r.top + Math.min(10, r.height / 2)
        )
        return !!hit && ac.contains(hit)
    })
}

test.describe('formula autocomplete @webkit', () => {
    test('is painted over the grid, not clipped by the cell editor', async ({
        page,
    }) => {
        await startFormula(page, '=su')
        await expect.poll(() => paintedOnTop(page)).toBe(true)
        // Lives outside the clipped box.
        expect(
            await completions(page).evaluate(
                (ac) =>
                    !ac.closest('.logisheets-inline-cell-editor') &&
                    ac.ownerDocument.body.contains(ac)
            )
        ).toBe(true)
    })

    test('keeps the selected suggestion readable', async ({page}) => {
        await startFormula(page, '=su')
        const selected = completions(page).locator('li[aria-selected]')
        await expect(selected).toHaveCount(1)
        const {color, background} = await selected.evaluate((li) => {
            const cs = getComputedStyle(li)
            return {color: cs.color, background: cs.backgroundColor}
        })
        expect(color).not.toBe(background)
        // CodeMirror's default selected text is white; on our light-blue
        // highlight that made the function name vanish.
        expect(color).not.toBe('rgb(255, 255, 255)')
    })

    test('a clicked suggestion fills in and keeps the edit going', async ({
        page,
    }) => {
        await startFormula(page, '=su')
        await completions(page)
            // "SUMIF(" — not SUMIFS.
            .locator('li', {hasText: 'SUMIF('})
            .click()
        await expect(editor(page)).toHaveText('=SUMIF()')
        await expect(page.locator('.cm-editor.cm-focused')).toHaveCount(1)
    })
})
