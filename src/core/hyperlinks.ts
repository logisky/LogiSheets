/**
 * Following a cell's hyperlink.
 *
 * The engine knows which cells are links (`CellInfo.isHyperlink`) and, asked
 * with `getHyperlink`, where one goes: an external `url`, or a `location` in
 * this workbook. Opening it is the host's job, and this is it.
 *
 * A link's target comes from the workbook, and a workbook can come from
 * anyone, so only `http(s):` and `mailto:` are ever opened. `javascript:` in
 * particular would run in this page's origin.
 */

import {isErrorMessage, type DataService} from 'logisheets-engine'
import type {HyperlinkInfo, SelectedData} from 'logisheets-web'
import {parseA1notation} from 'logisheets-core'
import {buildSelectedDataFromCellRange} from 'logisheets-engine'
import {isTauri, tauriInvoke} from '@/core/tauri'
import {
    findDefinedName,
    goToNameRange,
    loadDefinedNames,
    parseNameRange,
} from '@/core/defined-names'

const OPENABLE = /^(https?:\/\/|mailto:)/i

/**
 * The URL to open for a link's address, or `undefined` when it is not one we
 * open. A bare `www.example.com` gets `https://`, as a browser would.
 */
export function openableUrl(address: string): string | undefined {
    const url = address.trim()
    if (OPENABLE.test(url)) return url
    if (/^www\.[^\s/]+\.[^\s]+$/i.test(url)) return `https://${url}`
    return undefined
}

/** What following a link did, so the caller can say why nothing happened. */
export type FollowResult =
    | {kind: 'opened'}
    | {kind: 'moved'}
    | {kind: 'none'}
    | {kind: 'blocked'; url: string}
    | {kind: 'missing'; location: string}

export interface FollowContext {
    dataSvc: DataService
    /** The sheet the link is on; a bare `A1` location means this sheet. */
    sheetIdx: number
    /** The window to open a web link from — a pop-out's, when in one. */
    hostWindow: Window
    setActiveSheet: (idx: number) => void
    setSelection: (d: SelectedData) => void
}

export async function getHyperlink(
    dataSvc: DataService,
    sheetIdx: number,
    row: number,
    col: number
): Promise<HyperlinkInfo | null> {
    const r = await dataSvc.getWorkbook().getHyperlink({sheetIdx, row, col})
    return !r || isErrorMessage(r) ? null : r
}

export async function followHyperlink(
    ctx: FollowContext,
    row: number,
    col: number
): Promise<FollowResult> {
    const link = await getHyperlink(ctx.dataSvc, ctx.sheetIdx, row, col)
    if (!link) return {kind: 'none'}
    if (link.url) {
        const url = openableUrl(link.url)
        if (!url) return {kind: 'blocked', url: link.url}
        await openExternal(url, ctx.hostWindow)
        return {kind: 'opened'}
    }
    if (link.location) {
        const moved = await goToLocation(ctx, link.location)
        return moved
            ? {kind: 'moved'}
            : {kind: 'missing', location: link.location}
    }
    return {kind: 'none'}
}

async function openExternal(url: string, win: Window): Promise<void> {
    // In the desktop app `window.open` would open the site in an app window
    // (see `on_new_window`); the shell hands it to the system instead.
    if (isTauri()) {
        await tauriInvoke('open_url', {url})
        return
    }
    win.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Select a place in this workbook: `Sheet2!A1`, `'My sheet'!B2:C3`, a bare
 * `A1` on the link's own sheet, or a defined name that names a range.
 */
async function goToLocation(
    ctx: FollowContext,
    location: string
): Promise<boolean> {
    const text = location.trim()
    const qualified = parseNameRange(text)
    if (qualified) return go(ctx, qualified)
    const local = parseA1notation(text.replace(/\$/g, ''))
    if (local) {
        ctx.setSelection(
            buildSelectedDataFromCellRange(
                Math.min(local.rs, local.re ?? local.rs),
                Math.min(local.cs, local.ce ?? local.cs),
                Math.max(local.rs, local.re ?? local.rs),
                Math.max(local.cs, local.ce ?? local.cs),
                'none'
            )
        )
        return true
    }
    const name = findDefinedName(await loadDefinedNames(ctx.dataSvc), text)
    const range = name && parseNameRange(name.formula)
    return range ? go(ctx, range) : false
}

function go(
    ctx: FollowContext,
    range: NonNullable<ReturnType<typeof parseNameRange>>
): Promise<boolean> {
    return goToNameRange(
        ctx.dataSvc,
        range,
        ctx.sheetIdx,
        ctx.setActiveSheet,
        ctx.setSelection
    )
}
