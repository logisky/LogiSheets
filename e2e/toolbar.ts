import {expect, type Page} from '@playwright/test'

/**
 * Toolbar helpers for the tabbed ribbon.
 *
 * The ribbon only renders the active tab's controls, so a button that lives on
 * another tab is not merely hidden — it is absent from the DOM, and a plain
 * `getByRole` for it waits until the test times out. Reaching one therefore
 * means switching tabs first, which is what these do.
 */

export type ToolbarTab =
    | 'Home'
    | 'Insert'
    | 'Formulas'
    | 'Data'
    | 'View'
    | 'Advanced'

/** Switch the ribbon to `tab` and wait for it to actually be selected. */
export async function openToolbarTab(page: Page, tab: ToolbarTab) {
    const t = page.getByRole('tab', {name: tab, exact: true})
    await t.click()
    await expect(t).toHaveAttribute('aria-selected', 'true')
}

/**
 * The button for creating a block. It lives on the Advanced tab, with the rest
 * of what is particular to this spreadsheet rather than borrowed from Excel.
 */
export async function createBlockButton(page: Page) {
    await openToolbarTab(page, 'Advanced')
    return page.getByRole('button', {name: /CreateBlock/i})
}

/**
 * The craft panel toggle, also on the Advanced tab.
 *
 * Named "Crafts" after its visible label rather than "Toggle craft panel":
 * a control's accessible name should contain the text next to it, so the two
 * cannot drift apart.
 */
export async function craftToggle(page: Page) {
    await openToolbarTab(page, 'Advanced')
    return page.getByRole('button', {name: 'Crafts', exact: true})
}
